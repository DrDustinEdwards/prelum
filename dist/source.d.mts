/** @typedef {(typeof CHART_KINDS)[number]["value"]} ChartKind A chart type. */
/**
 * A CSV's column names, and which hold only numbers (the columns a chart can measure). RFC 4180 through site-runtime's reader
 * (a byte order mark dropped); a blank line is no row, and cells are trimmed.
 *
 * @param {string} csv
 * @returns {Array<{ name: string, numeric: boolean }>}
 */
export function csvColumns(csv: string): Array<{
    name: string;
    numeric: boolean;
}>;
/**
 * A `:::chart` block: the attributes on the directive, the data as a fenced CSV block, an optional caption. An empty title or
 * caption is left out; `alt` is the finding, shown under the title and the chart's text alternative.
 *
 * @param {{ type: string, x: string, y: readonly string[], title?: string, alt: string, caption?: string, csv: string }} fields
 * @returns {string}
 */
export function chartBlock({ type, x, y, title, alt, caption, csv }: {
    type: string;
    x: string;
    y: readonly string[];
    title?: string;
    alt: string;
    caption?: string;
    csv: string;
}): string;
/**
 * Each `:::chart` block in a body, with the line it starts on. A fence inside one does not end it, and a fence outside one (a
 * code sample showing the syntax) holds no chart.
 *
 * @param {string} body
 * @returns {Array<{ line: number, text: string }>}
 */
export function chartBlocks(body: string): Array<{
    line: number;
    text: string;
}>;
/**
 * An image with its alt text and, when it has one, its caption: a `:::figure` directive (the caption is its body), or with
 * `figure: false` (a site whose renderer has no figure syntax) plain Markdown with the caption as an emphasized line under it.
 * An empty alt is a decorative image: Prelum refuses `![](x)` and a figure with no alt, and reads `![""](x)` as decorative, so
 * a decorative image is always plain.
 *
 * @param {string} url
 * @param {string} alt
 * @param {{ caption?: string, figure?: boolean }} [options] `figure` default true
 * @returns {string}
 */
export function figureMarkup(url: string, alt: string, { caption, figure }?: {
    caption?: string;
    figure?: boolean;
}): string;
/**
 * Each image in a source with no alt text, or an empty one: Markdown, an HTML `<img>` and a `:::figure` directive. Code (fenced
 * blocks and inline spans) is skipped; the front matter is not body. `line` counts from the source's first line.
 *
 * @param {string} source
 * @returns {Array<{ excerpt: string, src: string, line: number }>}
 */
export function imagesWithoutAlt(source: string): Array<{
    excerpt: string;
    src: string;
    line: number;
}>;
/**
 * A full https address with a host: what a canonical link must be for a search engine to follow it.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAbsoluteHttps(value: string): boolean;
/** The chart types a `:::chart` block takes, with their labels. */
export const CHART_KINDS: readonly [{
    readonly value: "bar";
    readonly label: "Bar";
}, {
    readonly value: "line";
    readonly label: "Line";
}, {
    readonly value: "area";
    readonly label: "Area";
}, {
    readonly value: "dot";
    readonly label: "Dot";
}];
/**
 * A chart type.
 */
export type ChartKind = (typeof CHART_KINDS)[number]["value"];
