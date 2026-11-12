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

/**
 * The longest slug a site stores or an address segment takes. A separate limit, not part of SLUG_PATTERN, so the pattern can
 * go in a form's `pattern` attribute as it is.
 */
export const SLUG_MAX_LENGTH = 120;

/**
 * SLUG_PATTERN without its anchors, for an `<input pattern>`, which the browser anchors itself.
 */
export const SLUG_ATTRIBUTE_PATTERN = SLUG_PATTERN.source.slice(1, -1);

const SUFFIX_LETTERS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Six random a-z0-9 characters (36^6, about two billion), from the platform's CSPRNG. */
function randomSuffix() {
  let out = "";
  while (out.length < 6) {
    // 252 is the largest multiple of 36 under 256: a byte at or over it is skipped so each letter is equally likely.
    for (const byte of crypto.getRandomValues(new Uint8Array(8)))
      if (byte < 252 && out.length < 6) out += SUFFIX_LETTERS[byte % 36];
  }
  return out;
}

/**
 * `base` with `-suffix`, the base cut back to a whole word so the whole stays within `max`.
 * @param {string} base
 * @param {string} suffix
 * @param {number} max
 */
function withSuffix(base, suffix, max) {
  return `${slugify(base, { max: max - suffix.length - 1 }) || "x"}-${suffix}`;
}

/**
 * A slug for a new row that no other row holds. The base is `slugify(text, { max })`, or `fallback` when nothing is
 * left of the text.
 *
 * - With `taken` (a lookup in the site's table, sync or async): the base, then `base-2`, `base-3` ... up to `tries`
 *   candidates, then the base with a random six-character a-z0-9 suffix, so a pathological input never spins.
 *   `taken` answers true when another row holds the candidate (a row being renamed excludes itself).
 * - Without `taken`: always the base with a random suffix, for a table that would rather not look up (a club or a list
 *   whose name many readers share).
 *
 * The suffix uses a-z and 0-9 only, so it never puts `_` or `--` into a URL. The result is within `max` and matches
 * SLUG_PATTERN.
 *
 * @param {string} text
 * @param {{ fallback?: string, max?: number, tries?: number, taken?: (slug: string) => boolean | Promise<boolean> }} [options]
 * @returns {Promise<string>}
 */
export async function uniqueSlug(text, { fallback = "entry", max = SLUG_MAX_LENGTH, tries = 100, taken } = {}) {
  const base = slugify(text, { max }) || fallback;
  if (taken) {
    for (let n = 1; n <= tries; n++) {
      const candidate = n === 1 ? base : withSuffix(base, String(n), max);
      if (!(await taken(candidate))) return candidate;
    }
  }
  return withSuffix(base, randomSuffix(), max);
}
