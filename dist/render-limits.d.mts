/**
 * A cheap pass over the source before it is parsed, refusing the shapes that exhaust time or the stack under the byte cap: a line with more
 * than maxDepth block-quote markers in a row, a list indented deeper than maxDepth levels, and runs of reference links or emphasis
 * delimiters. Fenced code is skipped. Linear in the source.
 *
 * @param {string} file
 * @param {string} body
 * @param {number} maxDepth
 * @param {typeof DEFAULT_SCAN_LIMITS} limits
 */
export function assertScan(file: string, body: string, maxDepth: number, limits: typeof DEFAULT_SCAN_LIMITS): void;
/**
 * @param {string} file
 * @param {number} maxDepth
 */
export function remarkLimitDepth(file: string, maxDepth: number): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/** A source over this is refused before it is parsed: a 200,000-character bracket run took 2.8 s, which a Worker cannot be sent. */
export const DEFAULT_MAX_BYTES: number;
/** The deepest nesting of markdown nodes allowed (lists in quotes in lists), so a hostile source cannot recurse the stack. */
export const DEFAULT_MAX_DEPTH: 100;
export const encoder: TextEncoder;
export namespace DEFAULT_SCAN_LIMITS {
    let references: number;
    let emphasis: number;
    let brackets: number;
}
