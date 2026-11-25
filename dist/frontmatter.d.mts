/** @typedef {{ front: string | null, body: string, open: string, close: string }} Split A source cut at its fences; `front` is null when it has no frontmatter. */
/**
 * Cuts a source into its frontmatter text, its body and the fences between, so `open + front + close + body` is the source.
 * Blank lines after the closing fence go with the fence, so the body starts at its first line of text.
 * @param {string} source
 * @returns {Split}
 */
export function splitSource(source: string): Split;
/**
 * The source again from its parts.
 * @param {Split} s
 */
export function joinSource(s: Split): string;
/** @typedef {{ key: string | null, lines: string[] }} Block */
/**
 * The frontmatter's top-level blocks in order: a key line and every line after it up to the next key line, cut the way
 * `setBlock` cuts them. Lines before the first key form a block whose key is null.
 * @param {string} front
 * @returns {Block[]}
 */
export function blocks(front: string): Block[];
/**
 * A scalar without its YAML quotes: `"a \"b\""` is `a "b"`, `'it''s'` is `it's`; an unquoted value is only trimmed.
 * @param {string} raw
 */
export function unquote(raw: string): string;
/**
 * A value without its trailing YAML comment: a `#` after white space, outside quotes. Quotes count only where YAML starts one,
 * at the start of a value or inside a flow list, so an apostrophe in `don't # note` is just a letter.
 * @param {string} raw
 */
export function withoutComment(raw: string): string;
/**
 * The items of a flow list's inside, split at the commas outside quotes.
 * @param {string} inside
 */
export function splitFlow(inside: string): string[];
/**
 * One top-level key's value as one line of text, or "" when the frontmatter lacks it.
 * @param {string | null} front
 * @param {string} key
 */
export function readKey(front: string | null, key: string): string;
/**
 * One top-level key's list, flow (`[a, b]`) or block (`- a` lines), unquoted and in order; [] when the frontmatter lacks it.
 * @param {string | null} front
 * @param {string} key
 * @returns {string[]}
 */
export function readList(front: string | null, key: string): string[];
/**
 * The frontmatter with a top-level key set to a raw value (`draft: true`), added at the end when absent. Every other block
 * is returned as it was.
 * @param {string} front
 * @param {string} key
 * @param {string} raw
 */
export function setRawKey(front: string, key: string, raw: string): string;
/**
 * The frontmatter with one top-level key's block replaced by these lines (its key line first), added at the end when
 * absent, and removed when `lines` is empty. A block that already reads exactly so is left as it was, and every other
 * block is returned as it was.
 * @param {string} front
 * @param {string} key
 * @param {string[]} lines
 */
export function setBlock(front: string, key: string, lines: string[]): string;
/**
 * A whole file's frontmatter as data: each top-level key's value, a list where the key holds one (`[a, b]`, `- item`
 * lines, or nothing after the colon) and one line of text otherwise. Line endings are read as LF.
 * @param {string} source the whole file
 * @returns {{ data: Record<string, string | string[]>, body: string }} `body` is the file after the closing `---` and the
 *   blank lines after it, or the whole file when it has no frontmatter
 */
export function frontmatter(source: string): {
    data: Record<string, string | string[]>;
    body: string;
};
/**
 * A source cut at its fences; `front` is null when it has no frontmatter.
 */
export type Split = {
    front: string | null;
    body: string;
    open: string;
    close: string;
};
export type Block = {
    key: string | null;
    lines: string[];
};
