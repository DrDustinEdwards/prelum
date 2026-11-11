import { sha256Hex } from "@dustinedwards/site-runtime/encoding";

import { unescapeXml } from "./xml.mjs";

const ENDPOINT = "https://api.indexnow.org/indexnow";
// The protocol takes at most 10,000 URLs in one POST.
const MAX_URLS = 10_000;

/**
 * @typedef {object} IndexNowInput
 * @property {string} origin the production origin; IndexNow refuses a URL on any other host, so those are dropped
 * @property {string} key the site's IndexNow key, served as the whole body of `keyLocation`
 * @property {string[]} urls the changed pages
 * @property {string} [keyLocation] defaults to `${origin}/${key}.txt`
 * @property {string} [from] the URL of the request that made the change; a request on any other origin (localhost, a
 *   workers.dev preview) sends nothing
 * @property {typeof fetch} [fetch]
 */

/**
 * Tell Bing, Yandex and the other IndexNow engines that pages changed, instead of waiting for their next crawl. Never throws:
 * a network error or a non-2xx answer resolves to false, since a missed ping only means the engine finds the page on its own
 * schedule. On Workers, hand the promise to `ctx.waitUntil` so the response never waits on it.
 *
 * @param {IndexNowInput} input
 * @returns {Promise<boolean>}
 */
export async function submitIndexNow({
  origin: givenOrigin,
  key,
  urls,
  keyLocation,
  from,
  fetch: fetcher = fetch,
}) {
  try {
    const origin = givenOrigin.replace(/\/+$/, "");
    if (from !== undefined && new URL(from).origin !== origin) return false;
    const urlList = urls.filter((url) => url.startsWith(`${origin}/`));
    if (urlList.length === 0) return false;
    let ok = true;
    for (let i = 0; i < urlList.length; i += MAX_URLS) {
      const response = await fetcher(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: new URL(origin).host,
          key,
          keyLocation: keyLocation ?? `${origin}/${key}.txt`,
          urlList: urlList.slice(i, i + MAX_URLS),
        }),
      });
      ok = response.ok && ok;
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * Submit `urls` only when the set differs from the one last submitted, for a page that rebuilds the whole set on each
 * request (a sitemap): the sorted set's SHA-256 is kept in `kv` under `hashKey`, and it is written only once the
 * submission went, so a failed ping is tried again on the next request instead of being lost. Never throws, as
 * `submitIndexNow`; true when the set changed and was submitted.
 *
 * @param {IndexNowInput & { kv: { get(key: string): Promise<string | null>, put(key: string, value: string): Promise<void> }, hashKey: string }} input
 * @returns {Promise<boolean>}
 */
export async function submitIndexNowIfChanged({ kv, hashKey, ...input }) {
  try {
    const hash = await sha256Hex([...input.urls].sort().join("\n"));
    if (hash === (await kv.get(hashKey))) return false;
    if (!(await submitIndexNow(input))) return false;
    await kv.put(hashKey, hash);
    return true;
  } catch {
    return false;
  }
}

/**
 * The key file IndexNow fetches to prove the site owns its URLs: `/<key>.txt`, whose whole body is the key, with no
 * newline (IndexNow compares the body with the key and silently rejects a submission when they differ). The key is public
 * by the protocol's design, so a site commits it as a constant. `headers` adds to or replaces the Content-Type.
 *
 * @param {string} key
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function keyFileResponse(key, headers) {
  const merged = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
  for (const [name, value] of new Headers(headers)) merged.set(name, value);
  return new Response(key, { headers: merged });
}

/**
 * The URLs of a sitemap whose `<lastmod>` falls within `days` of `now`, for a static site that tells IndexNow after a
 * deploy which pages changed. A sitemap with no lastmod at all gives every URL: a small static site sends its whole list.
 *
 * @param {string} xml
 * @param {{ days?: number, now?: Date }} [options]
 * @returns {string[]}
 */
export function recentSitemapUrls(xml, { days = 2, now = new Date() } = {}) {
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => ({
    loc: unescapeXml(/<loc>\s*([^<]+?)\s*<\/loc>/.exec(body)?.[1] ?? ""),
    lastmod: /<lastmod>\s*([^<]+?)\s*<\/lastmod>/.exec(body)?.[1],
  }));
  const dated = entries.some((entry) => entry.lastmod);
  const since = now.getTime() - days * 86_400_000;
  return entries
    .filter(
      (entry) => entry.loc && (!dated || (entry.lastmod && Date.parse(entry.lastmod) >= since)),
    )
    .map((entry) => /** @type {string} */ (entry.loc));
}
