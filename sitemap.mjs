import { escapeXml, isoDay, toDate } from "./xml.mjs";

/** Google's and Bing's limit for one sitemap file: 50,000 URLs and 50 MiB uncompressed (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap). */
export const SITEMAP_MAX_URLS = 50_000;
export const SITEMAP_MAX_BYTES = 50 * 1024 * 1024;

const CHANGEFREQS = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];
const MAX_IMAGES = 1000;

const IMAGE_NAMESPACE = "http://www.google.com/schemas/sitemap-image/1.1";

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
 * is written once, the first time. A `priority` outside 0 to 1 or a `changefreq` outside the sitemaps.org set throws, and an entry's images past 1,000 are dropped. `changefreq` and `priority` are refused in the compact layout, which has no place for them,
 * rather than dropped without a word. A sitemap past `SITEMAP_MAX_URLS` URLs or `SITEMAP_MAX_BYTES` bytes throws, since a crawler
 * reads none of an oversize file: split the entries across files and list them with `sitemapIndexDocument`.
 *
 * @param {SitemapEntry[]} entries
 * @param {SitemapOptions} [options]
 * @returns {string}
 */
export function sitemapDocument(entries, options = {}) {
  const { layout = "compact", lastmodFormat = "day", trailingNewline = true } = options;
  const lastmodOf = (/** @type {SitemapEntry} */ entry) => {
    if (entry.lastmod === null || entry.lastmod === undefined) return null;
    return lastmodFormat === "day" ? isoDay(entry.lastmod) : datetime(entry.lastmod);
  };

  const imagesOf = (/** @type {SitemapEntry} */ entry) =>
    (entry.images ?? [])
      .slice(0, MAX_IMAGES)
      .map((image) => `<image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`);
  const seen = new Set();
  const unique = entries.filter((entry) => !seen.has(entry.loc) && seen.add(entry.loc));
  const hasImages = unique.some((entry) => (entry.images ?? []).length > 0);

  const rows = unique.map((entry) => {
    if (
      entry.priority !== undefined &&
      !(Number.isFinite(entry.priority) && entry.priority >= 0 && entry.priority <= 1)
    )
      throw new Error(`sitemap: ${entry.loc} has priority ${entry.priority}, which must be 0 to 1`);
    if (entry.changefreq !== undefined && !CHANGEFREQS.includes(entry.changefreq))
      throw new Error(
        `sitemap: ${entry.loc} has changefreq "${entry.changefreq}", which must be one of ${CHANGEFREQS.join(", ")}`,
      );
    const lastmod = lastmodOf(entry);
    const images = imagesOf(entry);
    if (layout === "compact") {
      if (entry.changefreq !== undefined || entry.priority !== undefined) {
        throw new Error(
          `sitemap: ${entry.loc} has changefreq or priority, which only the expanded layout writes`,
        );
      }
      return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${images.join("")}</url>`;
    }
    return [
      "  <url>",
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
      entry.changefreq ? `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>` : null,
      entry.priority === undefined ? null : `    <priority>${entry.priority.toFixed(1)}</priority>`,
      ...images.map((image) => `    ${image}`),
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  if (unique.length > SITEMAP_MAX_URLS)
    throw new Error(
      `sitemap: ${unique.length} URLs is past the ${SITEMAP_MAX_URLS} one file may list; split them and use sitemapIndexDocument`,
    );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${hasImages ? ` xmlns:image="${IMAGE_NAMESPACE}"` : ""}>
${rows.join("\n")}
</urlset>${trailingNewline ? "\n" : ""}`;
  if (new TextEncoder().encode(xml).length > SITEMAP_MAX_BYTES)
    throw new Error(
      `sitemap: the file is past ${SITEMAP_MAX_BYTES} bytes; split the entries and use sitemapIndexDocument`,
    );
  return xml;
}

/**
 * A sitemap index, the file that lists sitemap files once a site has more URLs than one holds (`SITEMAP_MAX_URLS`). Each entry's
 * `loc` is a sitemap's absolute URL and its `lastmod` the newest `lastmod` inside it. At most 50,000 sitemaps.
 *
 * @param {Array<{ loc: string, lastmod?: Date | number | string | null }>} sitemaps
 * @param {Pick<SitemapOptions, "lastmodFormat" | "trailingNewline">} [options]
 * @returns {string}
 */
export function sitemapIndexDocument(sitemaps, options = {}) {
  const { lastmodFormat = "day", trailingNewline = true } = options;
  if (sitemaps.length > SITEMAP_MAX_URLS)
    throw new Error(`sitemap index: ${sitemaps.length} sitemaps is past ${SITEMAP_MAX_URLS}`);
  const rows = sitemaps.map((entry) => {
    const lastmod =
      entry.lastmod === null || entry.lastmod === undefined
        ? null
        : lastmodFormat === "day"
          ? isoDay(entry.lastmod)
          : datetime(entry.lastmod);
    return `  <sitemap><loc>${escapeXml(entry.loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</sitemapindex>${trailingNewline ? "\n" : ""}`;
}

/** @param {Date | number | string} value */
function datetime(value) {
  const date = toDate(value, null);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
