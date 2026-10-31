/**
 * @param {Record<string, string>} attrs
 * @param {string} csv
 * @param {{ strict?: boolean }} [options] `strict` refuses the chart on an issue in STRICT_CHART_ISSUES, where
 *   the default only reports it (E4), so an editor can block a publish on one
 */
export function buildChartModel(attrs: Record<string, string>, csv: string, { strict }?: {
    strict?: boolean;
}): {
    type: string;
    alt: string;
    title: string;
    columns: string[];
    rows: string[][];
    html: string;
    issues: string[];
    /** What `render/chart-enhance` redraws the chart from: bar, line and area by their options, dot by its 240 px drawing. */
    redraw: {
        chart: "bar" | "line" | "area";
        options: Record<string, unknown>;
    } | {
        narrow: string;
    };
};
/**
 * The figure Enarratio drew, as hast, in Capsomer 0.53's chart frame: the markup of its `frameHtml(figure)`,
 * `div.cap-chart > div.cap-chart-figure > figure.enarratio`, written here so Capsomer is not a dependency.
 * Parsed rather than allowDangerousHtml, which would open raw HTML in every post. Enarratio's figcaption
 * is the head (title and finding). The author's caption is the caption under the chart, where Enarratio
 * puts its own; the directive's figure takes Enarratio's classes and data attributes, so there is one figure.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 * @param {any} figure the directive's figure node, which becomes the frame
 */
export function renderChartHast(model: ReturnType<typeof buildChartModel>, captionChildren: any[], figure: any): import("hast").ElementContent[];
export const CHART_TYPES: string[];
/** The issues `strict` refuses (E4): a reader would struggle with each, and the author can fix each in the directive. */
export const STRICT_CHART_ISSUES: string[];
