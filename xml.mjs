/**
 * The XML and feed-text helpers that were written again in about eight repositories, once, in the form of the best of them
 * (dustinedwards-info's rss-feed.mjs). Pure, no dependencies, Web-standard only: it runs unchanged in a Worker and in Node.
 */

// XML 1.0 section 2.2 forbids these even as character references: C0 controls other than tab, newline and carriage return,
// and U+FFFE and U+FFFF.
const INVALID_XML = /[\p{Cc}\uFFFE\uFFFF]/gu;

/** @param {string} text */
function stripInvalidXml(text) {
  // \p{Cc} is U+0000-001F and U+007F-009F; tab, newline, carriage return and the C1 range are valid XML 1.0.
  return text.replace(INVALID_XML, (char) => {
    const code = char.charCodeAt(0);
    return code === 9 || code === 10 || code === 13 || (code >= 0x7f && code <= 0x9f) ? char : "";
  });
}

const XML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** A code point XML 1.0 allows in a document (section 2.2). */
const isXmlChar = (/** @type {number} */ code) =>
  code === 9 ||
  code === 10 ||
  code === 13 ||
  (code >= 0x20 && code <= 0xd7ff) ||
  (code >= 0xe000 && code <= 0xfffd) ||
  (code >= 0x10000 && code <= 0x10ffff);

/**
 * The inverse of `escapeXml`: the five entities and numeric character references (`&#38;`, `&#x26;`, which other
 * generators write) back to their characters, in one pass so `&amp;lt;` becomes `&lt;`. A reference to a character XML 1.0
 * forbids (`&#0;`, a surrogate, past U+10FFFF) is left as written.
 *
 * @param {string} text
 * @returns {string}
 */
export function unescapeXml(text) {
  return String(text).replace(
    /&(?:(amp|lt|gt|quot|apos)|#(?:(\d{1,7})|x([0-9a-fA-F]{1,6})));/g,
    (whole, name, decimal, hex) => {
      if (name) return XML_ENTITIES[/** @type {keyof typeof XML_ENTITIES} */ (name)];
      const code = decimal ? Number(decimal) : parseInt(hex, 16);
      return isXmlChar(code) ? String.fromCodePoint(code) : whole;
    },
  );
}

/**
 * All five entities. Attribute values and element text both take this one, since it is safe in either.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeXml(value) {
  return stripInvalidXml(String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * A CDATA section ends at the first `]]>`, so it is closed and reopened around one; the two sections concatenate
 * transparently. A hand-written `<![CDATA[${text}]]>` loses the rest of the text, and the document, at that point.
 *
 * @param {unknown} content
 * @returns {string}
 */
export function cdata(content) {
  return `<![CDATA[${stripInvalidXml(String(content)).replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

/**
 * An RFC 822 date, which RSS `<pubDate>` requires, from a Date, an epoch in milliseconds, or the two string forms the sites
 * store: ISO 8601 (`2026-06-21T09:30:00Z`) and SQLite's `2026-06-21 09:30:00`, read as UTC. A value that is not a date reads
 * as the epoch, as the feeds it replaced did, so an item is never undated by accident.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string}
 */
export function rfc822(value) {
  return toDate(value).toUTCString();
}

/**
 * The calendar day of a date as `YYYY-MM-DD` (a sitemap `<lastmod>`), or null when there is none.
 *
 * @param {Date | number | string | null | undefined} value
 * @returns {string | null}
 */
export function isoDay(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value, null);
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/**
 * A Date from the same forms `rfc822` reads, SQLite's `2026-06-21 09:30:00` as UTC. Every feed and sitemap date goes through it,
 * so a build on a machine that is not on UTC writes the same instant as the Worker does.
 *
 * @param {Date | number | string | null | undefined} value
 * @param {Date | null} [fallback] what an unreadable value becomes; the epoch by default, an invalid Date when null
 * @returns {Date}
 */
export function toDate(value, fallback = new Date(0)) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? (fallback ?? new Date(NaN)) : value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && value !== "") {
    // No zone means UTC, wherever the build runs; an offset is honored with or without the `T`.
    const iso = value.replace(" ", "T");
    const time = iso.slice(iso.indexOf("T") + 1);
    const zoned = iso.includes("T") && /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(time);
    const date = new Date(zoned ? iso : `${iso}Z`);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return fallback ?? new Date(NaN);
}

/**
 * Not an HTML parser: only, in real tags (not in escaped text such as a code sample, nor in a comment), `href`, `src` and `srcset` values, double or single quoted, beginning with a single `/` are rewritten. A `//` value is
 * protocol-relative and already absolute. A feed item is read on someone else's origin, where a root-relative path resolves
 * against THEIR host.
 *
 * @param {string} html
 * @param {string} origin no trailing slash
 */
export function absolutizeUrls(html, origin) {
  const rootRelative = (/** @type {string} */ url) => url.replace(/^(\s*)\/(?!\/)/, `$1${origin}/`);
  return String(html).replace(
    // Comments and real tags only: `&lt;a href="/x"&gt;` in a code sample is text, and is left as written.
    /<!--[\s\S]*?-->|<[a-z][^\s>/]*(?:"[^"]*"|'[^']*'|[^>"'])*>/gi,
    (tag) =>
      tag.startsWith("<!--")
        ? tag
        : tag.replace(
            /([^\s"'<>=/]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)')/g,
            (whole, name, equals, double, single) => {
              const lower = String(name)
                .toLowerCase()
                .replace(/^data-/, "");
              if (lower !== "href" && lower !== "src" && lower !== "srcset") return whole;
              const quote = double === undefined ? "'" : '"';
              const value = String(double ?? single);
              const rewritten =
                lower === "srcset"
                  ? value.split(",").map(rootRelative).join(",")
                  : rootRelative(value);
              return `${name}${equals}${quote}${rewritten}${quote}`;
            },
          ),
  );
}

// Built from strings: a literal U+2028 is invisible and does not survive a copy.
const LINE_SEPARATOR = new RegExp("\\u2028", "g");
const PARAGRAPH_SEPARATOR = new RegExp("\\u2029", "g");

/**
 * A value as the text of a `<script type="application/ld+json">`. The element's content is raw text ended only by a
 * literal `</script`, so `<`, `>` and `&` are written as `\u003c`, `\u003e` and `\u0026`, and U+2028 and U+2029 as their
 * escapes (line terminators if the text is ever read as JavaScript). Every escape parses back to the same data.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function jsonLdText(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(LINE_SEPARATOR, "\\u2028")
    .replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

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
export function mathToTex(html) {
  const source = String(html);
  let out = "";
  let cursor = 0;

  for (;;) {
    // `katex-display` WRAPS the `katex` span, so matching the inner one first would leave the outer wrapper behind, empty,
    // around a `$$`.
    const display = source.indexOf('<span class="katex-display">', cursor);
    const inline = source.indexOf('<span class="katex">', cursor);
    if (display === -1 && inline === -1) break;
    const start = display === -1 ? inline : inline === -1 ? display : Math.min(display, inline);
    const isDisplay = start === display;

    const end = spanEnd(source, start);
    if (end === -1) break;

    const region = source.slice(start, end);
    const annotation = region.match(
      /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/,
    );
    // An empty annotation is left alone too, rather than emitting a bare pair of dollar signs.
    if (!annotation || !annotation[1]) {
      out += source.slice(cursor, end);
      cursor = end;
      continue;
    }

    const tex = annotation[1].trim();
    const delimiter = isDisplay ? "$$" : "$";
    out += source.slice(cursor, start) + delimiter + tex + delimiter;
    cursor = end;
  }

  return out + source.slice(cursor);
}

/**
 * -1 when the depth never returns to zero.
 *
 * @param {string} source @param {number} start index of the opening `<span`
 */
function spanEnd(source, start) {
  const OPEN = "<span";
  const CLOSE = "</span>";
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const open = source.indexOf(OPEN, i);
    const close = source.indexOf(CLOSE, i);
    if (close === -1) return -1;
    if (open !== -1 && open < close) {
      depth += 1;
      i = open + OPEN.length;
      continue;
    }
    depth -= 1;
    i = close + CLOSE.length;
    if (depth === 0) return i;
  }
  return -1;
}
