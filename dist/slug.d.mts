/**
 * One slug rule for every site: accents folded to their base letter (café → cafe), every run of anything else that is
 * not a-z or 0-9 made one hyphen, no hyphen at either end, and at most `max` characters, cut back to a whole word when it
 * can be. The empty string when nothing is left, so a caller with a fallback writes `slugify(x) || "entry"`.
 *
 * @param {string} text
 * @param {{ max?: number }} [options]
 * @returns {string}
 */
export function slugify(text: string, { max }?: {
    max?: number;
}): string;
/**
 * True when `value` is a slug by SLUG_PATTERN (and, given `max`, at most that long).
 *
 * @param {unknown} value
 * @param {{ max?: number }} [options]
 * @returns {value is string}
 */
export function isSlug(value: unknown, { max }?: {
    max?: number;
}): value is string;
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
export function uniqueSlug(text: string, { fallback, max, tries, taken }?: {
    fallback?: string;
    max?: number;
    tries?: number;
    taken?: (slug: string) => boolean | Promise<boolean>;
}): Promise<string>;
/**
 * What slugify gives, as a pattern: lower-case letters and digits in runs joined by single hyphens, none at either end.
 * The one rule a site holds a stored slug, an address segment or a key to, on the server and in a form's `pattern`.
 */
export const SLUG_PATTERN: RegExp;
/**
 * The longest slug a site stores or an address segment takes. A separate limit, not part of SLUG_PATTERN, so the pattern can
 * go in a form's `pattern` attribute as it is.
 */
export const SLUG_MAX_LENGTH: 120;
/**
 * SLUG_PATTERN without its anchors, for an `<input pattern>`, which the browser anchors itself.
 */
export const SLUG_ATTRIBUTE_PATTERN: string;
