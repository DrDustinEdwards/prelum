/**
 * The XML and feed-text helpers that were written again in about eight repositories, once, in the form of the best of them
 * (dustinedwards-info's rss-feed.mjs). Pure, no dependencies, Web-standard only: it runs unchanged in a Worker and in Node.
 */
/**
 * All five entities. Attribute values and element text both take this one, since it is safe in either.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value: unknown): string;
/**
 * Element text only: `&`, `<` and `>`. What a site that never puts a quote into a value (a URL, a category) wrote for
 * itself; `escapeXml` is safe wherever this is, and the two differ only on `"` and `'`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXmlText(value: unknown): string;
/**
 * A CDATA section ends at the first `]]>`, so it is closed and reopened around one; the two sections concatenate
 * transparently. A hand-written `<![CDATA[${text}]]>` loses the rest of the text, and the document, at that point.
 *
 * @param {unknown} content
 * @returns {string}
 */
export function cdata(content: unknown): string;
/**
 * An RFC 822 date, which RSS `<pubDate>` requires, from a Date, an epoch in milliseconds, or the two string forms the sites
 * store: ISO 8601 (`2026-06-21T09:30:00Z`) and SQLite's `2026-06-21 09:30:00`, read as UTC. A value that is not a date reads
 * as the epoch, as germomics always has, so an item is never undated by accident.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string}
 */
export function rfc822(value: Date | number | string | null | undefined): string;
/**
 * The calendar day of a date as `YYYY-MM-DD` (a sitemap `<lastmod>`), or null when there is none.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string | null}
 */
export function isoDay(value: Date | number | string | null | undefined): string | null;
/** A Date from a Date, an epoch in milliseconds, ISO 8601, or SQLite's `2026-06-21 09:30:00` read as UTC. */
export function toDate(value: Date | number | string | null | undefined, fallback?: Date | null): Date;
/**
 * Not an HTML parser: only `href`, `src` and `srcset` values beginning with a single `/` are rewritten. A `//` value is
 * protocol-relative and already absolute. A feed item is read on someone else's origin, where a root-relative path resolves
 * against THEIR host.
 *
 * @param {string} html
 * @param {string} origin no trailing slash
 */
export function absolutiseUrls(html: string, origin: string): string;
/**
 * For a site whose markdown renders math with KaTeX. A feed reader has no `katex.css`, so KaTeX's two trees (clipped MathML
 * and positioned HTML) would both show, garbled. The TeX comes from KaTeX's own annotation, taken still XML-escaped, because
 * unescaping would put a stray `<` into the reader's document.
 *
 * Counting spans is sound because nothing KaTeX nests inside an expression can close a span it did not open. An expression
 * with no closing tag or no annotation is left alone.
 *
 * @param {string} html
 */
export function mathToTex(html: string): string;
