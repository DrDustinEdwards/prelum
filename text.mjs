/** Silent reading speed for non-fiction in English, from Brysbaert's 2019 meta-analysis of 190 studies (238 words a minute). */
export const WORDS_PER_MINUTE = 238;

const segmenter = new Intl.Segmenter("en", { granularity: "word" });

/**
 * Words as Unicode counts them (Intl.Segmenter), so "don't", "co-author" and a CJK sentence count the way a reader reads them, where a
 * whitespace split does not.
 *
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
  let words = 0;
  for (const segment of segmenter.segment(text)) if (segment.isWordLike) words += 1;
  return words;
}

/**
 * Minutes to read, never less than one: the words at WORDS_PER_MINUTE plus Medium's image time, 12 seconds for the first image and one
 * second less for each after it, down to 3.
 *
 * @param {number} words
 * @param {number} [images]
 * @returns {number}
 */
export function readingMinutes(words, images = 0) {
  let seconds = (words / WORDS_PER_MINUTE) * 60;
  for (let i = 0; i < images; i += 1) seconds += Math.max(12 - i, 3);
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Text cut to at most `max` characters at a word boundary, with an ellipsis when cut. Whitespace runs become one space.
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function excerpt(text, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** @type {Record<string, string>} */
const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
  reg: "®",
  trade: "™",
  middot: "·",
  bull: "•",
};

// Block-level tags and `<br>` separate words; inline tags (`<b>`, `<a>`, `<code>`) sit inside them and add no space.
const BLOCK_TAG =
  /<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

/**
 * The text of an HTML fragment (a rendered body, an abstract title): scripts and styles dropped, then tags, Prelum's own `#` heading
 * anchor links (navigation, not words), entities decoded and white space collapsed. An entity it does not know is kept as written.
 * The result is text, so it is escaped where it is written, as every tag is.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<a\b[^>]*\bclass="heading-anchor"[^>]*>[\s\S]*?<\/a\s*>/gi, " ")
    .replace(BLOCK_TAG, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
      const code = decimal ? Number(decimal) : Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Seconds as an ISO 8601 duration (`PT1H2M3S`), the form schema.org's `duration` and `timeRequired` and a feed's `itunes:duration`
 * read; undefined for zero, negative or missing seconds, which would claim a length the media does not have.
 *
 * @param {number | null | undefined} totalSeconds
 * @returns {string | undefined}
 */
export function isoDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return undefined;
  const whole = Math.round(totalSeconds);
  if (whole === 0) return undefined;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}`;
}

// The network's no-wide-dash house style, as one check for every pipeline and validator that holds text to it.
// Escapes, so this file stays clean under the no-em-dash rule. U+2010 to U+2015 plus U+2212.
const WIDE_DASH = /[\u2010-\u2015\u2212]/g;

/**
 * Server-side half of the no-em-dash rule: a save to the stored source never meets the local hook.
 *
 * @param {string} text
 * @returns {Array<{ line: number, column: number, char: string, excerpt: string }>}
 */
export function findWideDashes(text) {
  /** @type {Array<{ line: number, column: number, char: string, excerpt: string }>} */
  const hits = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    WIDE_DASH.lastIndex = 0;
    let match;
    while ((match = WIDE_DASH.exec(line)) !== null) {
      hits.push({
        line: i + 1,
        column: match.index + 1,
        char: `U+${match[0].codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`,
        excerpt: line.slice(Math.max(0, match.index - 30), match.index + 30).trim(),
      });
    }
  });
  return hits;
}
