/**
 * One slug rule for every site: accents folded, every other run of non-alphanumerics one hyphen, none at the ends, at most
 * `max` characters. The empty string when nothing is left.
 */
export function slugify(text: string, options?: { max?: number }): string;

/** What slugify gives: lower-case letters and digits joined by single hyphens, none at either end. */
export const SLUG_PATTERN: RegExp;

/** True when `value` is a slug by SLUG_PATTERN (and, given `max`, at most that long). */
export function isSlug(value: unknown, options?: { max?: number }): value is string;

/** The longest slug a site stores or an address segment takes (120). */
export const SLUG_MAX_LENGTH: 120;

/** SLUG_PATTERN's source without its anchors, for an `<input pattern>`. */
export const SLUG_ATTRIBUTE_PATTERN: string;

/**
 * A slug for a new row that no other row holds: `slugify(text, { max })` (or `fallback`), then with `taken` the base,
 * `base-2` ... up to `tries`, then a random six-character a-z0-9 suffix; without `taken`, always the random suffix.
 * Within `max` and SLUG_PATTERN.
 */
export function uniqueSlug(
  text: string,
  options?: {
    fallback?: string;
    max?: number;
    tries?: number;
    taken?: (slug: string) => boolean | Promise<boolean>;
  },
): Promise<string>;
