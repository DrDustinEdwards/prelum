// Letters NFKD does not decompose.
/** @type {Record<string, string>} */
const FOLDED = { ß: "ss", ø: "o", æ: "ae", œ: "oe", đ: "d", ł: "l" };

/**
 * One slug rule for every site: accents folded to their base letter (café → cafe), every run of anything else that is
 * not a-z or 0-9 made one hyphen, no hyphen at either end, and at most `max` characters, cut back to a whole word when it
 * can be. The empty string when nothing is left, so a caller with a fallback writes `slugify(x) || "entry"`.
 *
 * @param {string} text
 * @param {{ max?: number }} [options]
 * @returns {string}
 */
export function slugify(text, { max = Infinity } = {}) {
  const slug = String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ßøæœđł]/g, (letter) => FOLDED[letter])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= max) return slug;
  // A whole word when the cut falls inside one; a single word longer than `max` is cut mid-word.
  const cut = slug.slice(0, max);
  const whole = slug[max] === "-" ? cut : cut.slice(0, cut.lastIndexOf("-"));
  return (whole || cut).replace(/-+$/, "");
}

/**
 * What slugify gives, as a pattern: lower-case letters and digits in runs joined by single hyphens, none at either end.
 * The one rule a site holds a stored slug, an address segment or a key to, on the server and in a form's `pattern`.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * True when `value` is a slug by SLUG_PATTERN (and, given `max`, at most that long).
 *
 * @param {unknown} value
 * @param {{ max?: number }} [options]
 * @returns {value is string}
 */
export function isSlug(value, { max = Infinity } = {}) {
  return typeof value === "string" && value.length <= max && SLUG_PATTERN.test(value);
}
