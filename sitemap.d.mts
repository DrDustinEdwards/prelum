/**
 * @typedef {object} SitemapEntry
 * @property {string} loc absolute URL
 * @property {Date | number | string | null} [lastmod]
 * @property {string} [changefreq]
 * @property {number} [priority] 0 to 1
 * @property {string[]} [images] absolute URLs of the images on the page, listed in Google's image sitemap extension
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
 * and the image namespace is declared only when some entry has one, so a sitemap without images is unchanged.
 *
 * @param {SitemapEntry[]} entries
 * @param {SitemapOptions} [options]
 * @returns {string}
 */
export function sitemapDocument(entries: SitemapEntry[], options?: SitemapOptions): string;
export type SitemapEntry = {
    /**
     * absolute URL
     */
    loc: string;
    lastmod?: Date | number | string | null;
    changefreq?: string;
    /**
     * 0 to 1
     */
    priority?: number;
    /**
     * absolute URLs of the images on the page, listed in Google's image sitemap extension
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
