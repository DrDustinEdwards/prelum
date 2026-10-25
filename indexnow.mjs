const ENDPOINT = "https://api.indexnow.org/indexnow";

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
export async function submitIndexNow({ origin, key, urls, keyLocation, from, fetch: fetcher = fetch }) {
  try {
    if (from !== undefined && new URL(from).origin !== origin) return false;
    const urlList = urls.filter((url) => url.startsWith(`${origin}/`));
    if (urlList.length === 0) return false;
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(origin).host,
        key,
        keyLocation: keyLocation ?? `${origin}/${key}.txt`,
        urlList,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
