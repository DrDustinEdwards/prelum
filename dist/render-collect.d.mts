/**
 * @param {Array<{ depth: number, id: string, text: string }>} sink
 */
export function rehypeCollectToc(sink: Array<{
    depth: number;
    id: string;
    text: string;
}>): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/**
 * rehype-slug, then every id it wrote made unique against every other id in the tree: a sidenote's `sn-1`, the footnotes heading's
 * `footnote-label`, any id a plugin wrote. rehype-slug alone only avoids the headings it slugged, so an author's heading "Sn 1" or
 * "Footnote label" shared an id with those (a duplicate id breaks #links, aria-labelledby and axe `duplicate-id`). The author's heading
 * gives way: it becomes `sn-1-1`.
 */
export function rehypeUniqueSlug(): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/**
 * The reading facts, counted from the rendered tree so they are the words a reader sees: no markdown syntax, no directive attributes.
 * Runs before the autolinks append their "#" and before KaTeX doubles each expression.
 *
 * @param {{ words: number, images: number, excerpt: string }} sink
 */
export function rehypeCollectText(sink: {
    words: number;
    images: number;
    excerpt: string;
}): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
