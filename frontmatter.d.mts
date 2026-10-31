/** A source cut at its fences: `open + front + close + body` is the source. `front` is null when it has no frontmatter. */
export type Split = { front: string | null; body: string; open: string; close: string };
/**
 * Cuts a source into its frontmatter text, its body and the fences between. Blank lines after the closing fence go with
 * the fence, so the body starts at its first line of text.
 */
export function splitSource(source: string): Split;
/** The source again from its parts. */
export function joinSource(s: Split): string;
/** One top-level key's value as one line of text, or "" when the frontmatter lacks it. */
export function readKey(front: string | null, key: string): string;
/** One top-level key's list, flow (`[a, b]`) or block (`- a` lines), unquoted and in order; [] when the frontmatter lacks it. */
export function readList(front: string | null, key: string): string[];
/** The frontmatter with a top-level key set to a raw value, added at the end when absent; every other block as it was. */
export function setRawKey(front: string, key: string, raw: string): string;
/**
 * The frontmatter with one top-level key's block replaced by these lines (its key line first), added at the end when
 * absent, removed when `lines` is empty; every other block as it was.
 */
export function setBlock(front: string, key: string, lines: string[]): string;
/**
 * A whole file's frontmatter as data: a list where the key holds one (`[a, b]`, `- item` lines, or nothing after the
 * colon), one line of text otherwise. `body` is the file after the closing `---` and the blank lines after it.
 */
export function frontmatter(source: string): {
    data: Record<string, string | string[]>;
    body: string;
};
