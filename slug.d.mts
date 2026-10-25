/**
 * One slug rule for every site: accents folded, every other run of non-alphanumerics one hyphen, none at the ends, at most
 * `max` characters. The empty string when nothing is left.
 */
export function slugify(text: string, options?: { max?: number }): string;
