/**
 * @typedef {object} Matter
 * @property {Record<string, unknown>} data The frontmatter's mapping; `{}` when the file has none or it holds only comments.
 * @property {string} content The file after the closing line and the one line break after it, or the whole file when it has no frontmatter.
 * @property {string} matter The frontmatter's text between the fences, `""` when the file has none.
 */
/**
 * The file's frontmatter parsed and the rest of it. A file opens its frontmatter with `---` on its first line (a byte order
 * mark is dropped; `----` is not a fence) and closes it at the first line that starts with `---`; with no closing line the
 * whole file is frontmatter and the content is empty. The one line break after the closing line is not content.
 * @param {string} source
 * @returns {Matter}
 */
export function matter(source: string): Matter;
/**
 * A file from its content and data: the data as a `---` block, then the content. Empty data writes no block. Long text is not
 * folded, and a date at UTC midnight is written as the day.
 * @param {string} content
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function stringifyMatter(content: string, data: Record<string, unknown>): string;
export type Matter = {
    /**
     * The frontmatter's mapping; `{}` when the file has none or it holds only comments.
     */
    data: Record<string, unknown>;
    /**
     * The file after the closing line and the one line break after it, or the whole file when it has no frontmatter.
     */
    content: string;
    /**
     * The frontmatter's text between the fences, `""` when the file has none.
     */
    matter: string;
};
