/**
 * Enhances every Prelum chart under `root` and redraws each to its frame's width while the page lives. Calling it again is safe:
 * a chart is enhanced once.
 *
 * @param {ParentNode} [root]
 * @param {import("enarratio/enhance").EnhanceOptions} [options] passed to Enarratio's `enhance`
 * @returns {Array<{ frame: HTMLElement, destroy(): void }>}
 */
export function enhanceCharts(root?: ParentNode, options?: import("enarratio/enhance").EnhanceOptions): Array<{
    frame: HTMLElement;
    destroy(): void;
}>;
