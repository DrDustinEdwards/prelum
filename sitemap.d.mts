/** Google's and Bing's limit for one sitemap file: 50,000 URLs and 50 MiB uncompressed (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). */
export const SITEMAP_MAX_URLS: 50000;
export const SITEMAP_MAX_BYTES: number;
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
 * is written once, the first time. `changefreq` and `priority` are refused in the compact layout, which has no place for them,
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
 */
export function sitemapIndexDocument(
  sitemaps: Array<{
    loc: string;
    lastmod?: Date | number | string | null;
  }>,
  options?: Pick<SitemapOptions, "lastmodFormat" | "trailingNewline">,
): string;
export type SitemapEntry = {
  /**
   * absolute URL
   */
  loc: string;
  lastmod?: Date | number | string | null;
  /**
   * expanded layout only (Google ignores it)
   */
  changefreq?: string;
  /**
   * 0 to 1, expanded layout only (Google ignores it)
   */
  priority?: number;
  /**
   * absolute URLs of the images the page shows, listed in Google's image sitemap extension. A rendered page's are the
   * `mediaRefs` entries `render` returns with form `markdown-image` or `figure-directive`, each key made the image's
   * absolute URL again. Another host is allowed (a media host verified in Search Console); 1,000 at most
   */
  images?: string[];
};
export type SitemapOptions = {
  /**
   * compact is one line per url; expanded is one element per line
   */
  layout?: "compact" | "expanded";
  /**
   * `2026-07-01` or `2026-07-01T12:00:00.000Z`
   */
  lastmodFormat?: "day" | "datetime";
  trailingNewline?: boolean;
};
