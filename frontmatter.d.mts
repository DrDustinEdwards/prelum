/**
 * The small YAML subset the family's Markdown files open with, between `---` lines: `key: value`, `key: [a, b]`, and `key:`
 * followed by `- item` lines. Quotes around a value are taken off. Anything else (nesting, multi-line strings, numbers and
 * booleans as types) is not read: every value is a string or a list of strings, and a line that is not one of the three forms
 * is skipped. Capsomer's site and its bin each wrote this for themselves; it is theirs, moved here.
 *
 * @param {string} source the whole file
 * @returns {{ data: Record<string, string | string[]>, body: string }} `body` is the file after the closing `---`, or the
 *   whole file when it has no frontmatter
 */
export function frontmatter(source: string): {
    data: Record<string, string | string[]>;
    body: string;
};
