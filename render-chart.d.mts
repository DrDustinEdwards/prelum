/**
 * @param {Record<string, string>} attrs
 * @param {string} csv
 */
export function buildChartModel(attrs: Record<string, string>, csv: string): {
    type: string;
    alt: string;
    title: string;
    columns: string[];
    rows: string[][];
    html: string;
};
/**
 * The figure Enarratio drew, as hast. Parsed rather than allowDangerousHtml, which would open raw HTML
 * in every post. The author's caption replaces Enarratio's own and sits where it does, above the
 * data table; the outer figure takes Enarratio's classes and data attributes, so there is one figure.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 * @param {any} figure the directive's figure node, whose properties the chart's merge into
 */
export function renderChartHast(model: ReturnType<typeof buildChartModel>, captionChildren: any[], figure: any): import("hast").ElementContent[];
export const CHART_TYPES: string[];
