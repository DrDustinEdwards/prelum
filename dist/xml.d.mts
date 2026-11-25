/**
 * The inverse of `escapeXml`: the five entities and numeric character references (`&#38;`, `&#x26;`, which other
 * generators write) back to their characters, in one pass so `&amp;lt;` becomes `&lt;`. A reference to a character XML 1.0
 * forbids (`&#0;`, a surrogate, past U+10FFFF) is left as written.
 *
 * @param {string} text
 * @returns {string}
 */
export function unescapeXml(text: string): string;
/**
 * All five entities. Attribute values and element text both take this one, since it is safe in either.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value: unknown): string;
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
 * as the epoch, so an item is never undated by accident.
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
/**
 * A Date from the same forms `rfc822` reads, SQLite's `2026-06-21 09:30:00` as UTC. Every feed and sitemap date goes through it,
 * so a build on a machine that is not on UTC writes the same instant as the Worker does.
 *
 * @param {Date | number | string | null | undefined} value
 * @param {Date | null} [fallback] what an unreadable value becomes; the epoch by default, an invalid Date when null
 * @returns {Date}
 */
export function feedDate(value: Date | number | string | null | undefined, fallback?: Date | null): Date;
/**
 * Not an HTML parser: only, in real tags (not in escaped text such as a code sample, nor in a comment), `href`, `src` and `srcset` values, double or single quoted, beginning with a single `/` are rewritten. A `//` value is
 * protocol-relative and already absolute. A feed item is read on someone else's origin, where a root-relative path resolves
 * against THEIR host.
 *
 * @param {string} html
 * @param {string} origin no trailing slash
 */
export function absolutizeUrls(html: string, origin: string): string;
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
/**
 * A text document with its type and a public max-age, `headers` applied over them.
 *
 * @param {string} body
 * @param {string} type
 * @param {number} maxAge
 * @param {HeadersInit} [headers]
 */
export function documentResponse(body: string, type: string, maxAge: number, headers?: HeadersInit): Response;
