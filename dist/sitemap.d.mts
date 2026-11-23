/**
 * @typedef {object} SitemapEntry
 * @property {string} loc absolute URL
 * @property {Date | number | string | null} [lastmod]
 * @property {string} [changefreq] expanded layout only (Google ignores it)
 * @property {number} [priority] 0 to 1, expanded layout only (Google ignores it)
 * @property {string[]} [images] absolute URLs of the images the page shows, listed in Google's image sitemap extension. A
 *   rendered page's are the `mediaRefs` entries `render` returns with form `markdown-image` or `figure-directive`, each key
 *   made the image's absolute URL again. Another host is allowed (a media host verified in Search Console); 1,000 at most
 */
/**
 * @typedef {object} SitemapOptions
 * @property {"compact" | "expanded"} [layout] compact is one line per url; expanded is one element per line
 * @property {"day" | "datetime"} [lastmodFormat] `2026-07-01` or `2026-07-01T12:00:00.000Z`
 * @property {boolean} [trailingNewline]
 */
/**
 * Sitemaps differ between the sites only in layout, lastmod precision and the trailing newline, so those are options and every
 * default is this site's own. `loc` is escaped: a URL with `&` in its query would otherwise end the document.
 *
 * An entry's `images` become `<image:image>` elements (https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps),
 * and the image namespace is declared only when some entry has one, so a sitemap without images is unchanged. A URL listed twice
 * is written once, the first time. A `priority` outside 0 to 1 or finer than 0.1 (0.25 would be written as 0.3) or a `changefreq` outside the sitemaps.org set throws, and an entry's images past 1,000 are dropped. `changefreq` and `priority` are refused in the compact layout, which has no place for them,
 * rather than dropped without a word. A sitemap past `SITEMAP_MAX_URLS` URLs or `SITEMAP_MAX_BYTES` bytes throws, since a crawler
 * reads none of an oversize file: split the entries across files and list them with `sitemapIndexDocument`.
 *
 * @param {SitemapEntry[]} entries
 * @param {SitemapOptions} [options]
 * @returns {string}
 */
export function sitemapDocument(entries: SitemapEntry[], options?: SitemapOptions): string;
/**
 * A sitemap index, the file that lists sitemap files once a site has more URLs than one holds (`SITEMAP_MAX_URLS`). Each entry's
 * `loc` is a sitemap's absolute URL and its `lastmod` the newest `lastmod` inside it. At most 50,000 sitemaps.
 *
 * @param {Array<{ loc: string, lastmod?: Date | number | string | null }>} sitemaps
 * @param {Pick<SitemapOptions, "lastmodFormat" | "trailingNewline">} [options]
 * @returns {string}
 */
export function sitemapIndexDocument(sitemaps: Array<{
    loc: string;
    lastmod?: Date | number | string | null;
}>, options?: Pick<SitemapOptions, "lastmodFormat" | "trailingNewline">): string;
/**
 * `sitemap.xml` as a whole response, the route every site wrote: `sitemapDocument(entries, options)` as
 * `application/xml; charset=utf-8`, cached for an hour. `headers` adds to those or replaces the caching.
 *
 * @param {SitemapEntry[]} entries
 * @param {SitemapOptions & { headers?: HeadersInit }} [options]
 * @returns {Response}
 */
export function sitemapResponse(entries: SitemapEntry[], { headers, ...options }?: SitemapOptions & {
    headers?: HeadersInit;
}): Response;
/**
 * The `<url>` and `<sitemap>` entries of a sitemap or sitemap index, in order, each `{ loc, lastmod }`: `loc` trimmed and
 * entity-decoded, `lastmod` the text or null. An entry with no `<loc>` is left out. The one reader the audit and IndexNow
 * share; for the addresses alone, site-runtime's `sitemapLocs`.
 *
 * @param {string} xml
 * @returns {Array<{ loc: string, lastmod: string | null }>}
 */
export function sitemapEntries(xml: string): Array<{
    loc: string;
    lastmod: string | null;
}>;
/** Google's and Bing's limit for one sitemap file: 50,000 URLs and 50 MiB uncompressed (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). */
export const SITEMAP_MAX_URLS: 50000;
export const SITEMAP_MAX_BYTES: number;
export type SitemapEntry = {
    /**
     * absolute URL
     */
    loc: string;
    lastmod?: string | number | Date | null | undefined;
    /**
     * expanded layout only (Google ignores it)
     */
    changefreq?: string | undefined;
    /**
     * 0 to 1, expanded layout only (Google ignores it)
     */
    priority?: number | undefined;
    /**
     * absolute URLs of the images the page shows, listed in Google's image sitemap extension. A
     * rendered page's are the `mediaRefs` entries `render` returns with form `markdown-image` or `figure-directive`, each key
     * made the image's absolute URL again. Another host is allowed (a media host verified in Search Console); 1,000 at most
     */
    images?: string[] | undefined;
};
export type SitemapOptions = {
    /**
     * compact is one line per url; expanded is one element per line
     */
    layout?: "compact" | "expanded" | undefined;
    /**
     * `2026-07-01` or `2026-07-01T12:00:00.000Z`
     */
    lastmodFormat?: "day" | "datetime" | undefined;
    trailingNewline?: boolean | undefined;
};
