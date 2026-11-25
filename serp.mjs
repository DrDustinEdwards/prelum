import { htmlToText } from "./text.mjs";

/**
 * Google cuts a result's title and snippet by the width they draw at, not by a count of characters
 * (https://developers.google.com/search/docs/appearance/title-link: "titles are truncated ... to fit the device width"):
 * on a desktop result the title is 20 px Arial in a column about 600 px wide, the snippet 14 px Arial in about 920 px, the
 * measures SERP preview tools use. So the length is measured in pixels with Arial's widths (`serpWidth`): "about 60
 * characters" both flagged 62 narrow characters that fit and passed 55 wide ones that do not.
 */
export const SERP_TITLE = Object.freeze({ px: 600, font: 20 });
export const SERP_DESCRIPTION = Object.freeze({ px: 920, font: 14 });

// Arial's advance widths, in thousandths of an em, from its metrics (the same as Helvetica's AFM), for the characters
// titles use; any other character takes the width of a lower-case letter, 556.
const ARIAL = new Map(
  Object.entries({
    " ": 278,
    "!": 278,
    '"': 355,
    "#": 556,
    $: 556,
    "%": 889,
    "&": 667,
    "'": 191,
    "(": 333,
    ")": 333,
    "*": 389,
    "+": 584,
    ",": 278,
    "-": 333,
    ".": 278,
    "/": 278,
    ":": 278,
    ";": 278,
    "<": 584,
    "=": 584,
    ">": 584,
    "?": 556,
    "@": 1015,
    "[": 278,
    "\\": 278,
    "]": 278,
    "^": 469,
    _: 556,
    "`": 333,
    "{": 334,
    "|": 260,
    "}": 334,
    "~": 584,
    A: 667,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 500,
    K: 667,
    L: 556,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611,
    a: 556,
    b: 556,
    c: 500,
    d: 556,
    e: 556,
    f: 278,
    g: 556,
    h: 556,
    i: 222,
    j: 222,
    k: 500,
    l: 222,
    m: 833,
    n: 556,
    o: 556,
    p: 556,
    q: 556,
    r: 333,
    s: 500,
    t: 278,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 500,
    "–": 556,
    "—": 1000,
    "‘": 222,
    "’": 222,
    "“": 333,
    "”": 333,
    "…": 1000,
    "·": 278,
    "•": 350,
    "©": 737,
    "®": 737,
    "™": 1000,
  }),
);
for (const digit of "0123456789") ARIAL.set(digit, 556);

/** The width `text` draws at in Arial at `font` px, as Google's result shows it. */
export function serpWidth(/** @type {string} */ text, /** @type {number} */ font) {
  let units = 0;
  for (const char of text) units += ARIAL.get(char) ?? 556;
  return (units * font) / 1000;
}

/**
 * Cut at a word boundary and mark the cut with "...", within `limit` in all: a width (`SERP_TITLE`, `SERP_DESCRIPTION`)
 * for what Google's result shows, or a number of characters for a field counted that way (X's image alt).
 *
 * @param {string} text
 * @param {number | { px: number, font: number }} limit
 */
export function truncateForSerp(text, limit) {
  const size =
    typeof limit === "number"
      ? (/** @type {string} */ t) => Array.from(t).length
      : (/** @type {string} */ t) => serpWidth(t, limit.font);
  const max = typeof limit === "number" ? limit : limit.px;
  if (size(text) <= max) return text;
  // The "..." counts toward the limit, and punctuation left before it goes, so the cut never reads ",...".
  const chars = Array.from(text);
  let end = chars.length;
  while (end > 0 && size(`${chars.slice(0, end).join("")}...`) > max) end--;
  const cut = chars.slice(0, end).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > cut.length * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, "")}...`;
}

/**
 * The `<title>` a search result shows: the title with the site's suffix where both fit, else the suffix dropped and the
 * title cut at a word. Only the `<title>` is shortened; pass the whole title as `socialTitle` and keep it in the heading.
 *
 * @param {string} title
 * @param {string} suffix e.g. " | Example Co"
 */
export function searchTitle(title, suffix) {
  const full = `${title}${suffix}`;
  return serpWidth(full, SERP_TITLE.font) <= SERP_TITLE.px
    ? full
    : truncateForSerp(title, SERP_TITLE);
}

/**
 * A meta tag's text from HTML (an excerpt, an abstract title): scripts, styles and tags dropped, entities decoded, white
 * space collapsed, then cut at a word to `limit` (by default `SERP_DESCRIPTION`'s width; a number is characters, and
 * `Infinity` keeps it whole). An
 * entity it does not know is kept as written. The result is text, so it is escaped where it is written, as every tag is.
 *
 * @param {string} html
 * @param {number | { px: number, font: number }} [limit]
 */
export function metaText(html, limit = SERP_DESCRIPTION) {
  return truncateForSerp(htmlToText(html), limit);
}
