/**
 * A header cell with no content (the top-left corner of a comparison table, `| | A | B |`) is a table header with no name:
 * axe `empty-table-header`, and a screen reader announces the column with nothing. W3C WAI's tables tutorial says a corner
 * that names nothing is a plain cell, so it becomes a `td`.
 */
export function rehypeEmptyHeaders(): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/** A wrapper, not display: block on the table, which can strip the table role from a screen reader. */
export function rehypeTableScroll(): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/**
 * After the highlighter, so its output is named too. shiki swaps each pre for a root holding the new one, so a framed block's pre is
 * found under its figure, not as the figure's child.
 */
export function rehypeCodeRegions(): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
export function rehypeTaskListLabels(): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
