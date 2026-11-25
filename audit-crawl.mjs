import { sitemapEntries } from "./sitemap.mjs";
import { internalLinks, isRedirect, normalize, resolve, sameOrigin } from "./audit-read.mjs";

/** @typedef {import("./audit.mjs").AuditPage} AuditPage */

/** How many redirects `crawlSite` follows from one URL, so a chain is seen hop by hop and a loop ends. */
const MAX_HOPS = 5;

/**
 * @typedef {object} CrawlInput
 * @property {string} origin the production origin; only its URLs are fetched
 * @property {typeof fetch} fetch every request goes through it, so a scheduled job can pass its own (and a test a fake)
 * @property {number} [maxPages] the most pages fetched in all, redirect hops and link checks included (200)
 * @property {string} [sitemapPath] where the sitemap is (`/sitemap.xml`); a sitemap index is followed one level
 */

/**
 * Fetch a site the way an audit crawler does, for `auditPages`: every sitemap URL with `redirect: "manual"`, following up to
 * five redirects itself so each hop is a page and a chain shows; then each same-origin link target those pages name that
 * the sitemap did not, its HTML kept so `auditPages` can tell an indexable page the sitemap left out. Sequential, and never throws: a fetch that fails is a
 * page with status 0 and its error. A browser's fetch hides a manual redirect's status, so run it in a Worker or Node.
 *
 * @param {CrawlInput} input
 * @returns {Promise<{ pages: AuditPage[], sitemap: string[], robots: string | null, lastmods: Record<string, string | null> }>}
 *   `robots` is `/robots.txt`'s text, null when it did not load as text; `lastmods` each sitemap URL's `lastmod` (null for
 *   none); pass both to `auditPages`
 */
export async function crawlSite({
  origin,
  fetch: fetcher,
  maxPages = 200,
  sitemapPath = "/sitemap.xml",
}) {
  const entries = await readSitemap(fetcher, new URL(sitemapPath, origin).href, origin, true);
  const sitemap = [...new Set(entries.map((entry) => entry.loc))];
  /** @type {Record<string, string | null>} */
  const lastmods = {};
  for (const entry of entries) lastmods[entry.loc] ??= entry.lastmod;
  const robots = await readRobots(fetcher, origin);
  /** @type {AuditPage[]} */
  const pages = [];
  const seen = new Set();

  for (let url of sitemap) {
    /** @type {string[]} */
    const chain = [];
    for (
      let hop = 0;
      hop <= MAX_HOPS && pages.length < maxPages && !seen.has(normalize(url));
      hop++
    ) {
      seen.add(normalize(url));
      const page = await fetchPage(fetcher, url);
      if (chain.length > 0) page.redirectedFrom = [...chain];
      pages.push(page);
      const next = isRedirect(page) ? resolve(page.location, url) : null;
      if (!next || new URL(next).origin !== origin) break;
      chain.push(url);
      url = next;
    }
  }

  for (const page of pages.filter((each) => each.html !== undefined)) {
    for (const url of internalLinks(/** @type {string} */ (page.html), page.url, origin)) {
      if (pages.length >= maxPages) return { pages, sitemap, robots, lastmods };
      if (seen.has(normalize(url))) continue;
      seen.add(normalize(url));
      pages.push(await fetchPage(fetcher, url));
    }
  }
  return { pages, sitemap, robots, lastmods };
}

/** @param {typeof fetch} fetcher @param {string} origin @returns {Promise<string | null>} */
async function readRobots(fetcher, origin) {
  try {
    const response = await fetcher(`${origin}/robots.txt`);
    if (!response.ok || !/text\/plain/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

/** @param {typeof fetch} fetcher @param {string} url @param {string} origin @param {boolean} index @returns {Promise<Array<{ loc: string, lastmod: string | null }>>} */
async function readSitemap(fetcher, url, origin, index) {
  let xml;
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      await response.body?.cancel();
      return [];
    }
    xml = await response.text();
  } catch {
    return [];
  }
  const isIndex = /<sitemapindex\b/i.test(xml);
  const entries = sitemapEntries(xml).filter((entry) => sameOrigin(entry.loc, origin));
  if (!isIndex) return entries;
  if (!index) return [];
  const urls = [];
  for (const entry of entries) urls.push(...(await readSitemap(fetcher, entry.loc, origin, false)));
  return urls;
}

/** @param {typeof fetch} fetcher @param {string} url @returns {Promise<AuditPage>} */
async function fetchPage(fetcher, url) {
  try {
    const response = await fetcher(url, { redirect: "manual" });
    /** @type {Record<string, string>} */
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    /** @type {AuditPage} */
    const page = { url, status: response.status, headers };
    if (headers.location) page.location = headers.location;
    if (response.status === 200 && /html/i.test(headers["content-type"] ?? "text/html"))
      page.html = await response.text();
    else await response.body?.cancel();
    return page;
  } catch (error) {
    return { url, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}
