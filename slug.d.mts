/**
 * One slug rule for every site: accents folded, every other run of non-alphanumerics one hyphen, none at the ends, at most
 * `max` characters. The empty string when nothing is left.
 */
export function slugify(text: string, options?: { max?: number }): string;

/** What slugify gives: lower-case letters and digits joined by single hyphens, none at either end. */
export const SLUG_PATTERN: RegExp;

/** True when `value` is a slug by SLUG_PATTERN (and, given `max`, at most that long). */
export function isSlug(value: unknown, options?: { max?: number }): value is string;
