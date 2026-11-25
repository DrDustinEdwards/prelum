/**
 * @typedef {object} RenderPack
 * @property {string} name
 * @property {readonly string[]} directives every directive name the pack handles, so the unknown-directive guard allows them
 * @property {(context: { file: string, body: string, warn: (warning: { line: number | null, message: string }) => void }) => {
 *   remark: Array<[unknown, ...unknown[]]>,
 *   rehype: Array<[unknown, ...unknown[]]>,
 *   result?: () => Record<string, unknown>,
 * }} setup called once per render; `result` is merged into what render returns, and `warn` adds to its warnings
 */
/**
 * The editorial directives, in a fixed order so the output is the same bytes.
 *
 * @param {object} options
 * @param {string} options.assetPrefix the prefix of the site's diagram assets, for example "example-"
 * @param {(src: string, context: { file: string }) => string | Promise<string>} [options.chartData] reads the CSV a
 *   `:::chart{src="..."}` cites (a URL or a media path), at render time; without it a `src` is refused
 * @param {boolean} [options.strictCharts] refuse a chart with no title or too many series, where the default renders it with a warning
 * @param {Record<string, { width: number, height: number }>} [options.diagramSizes] the DIAGRAM_SIZES_FILE drawDiagrams writes
 *   beside the drawings, which sizes each diagram's images; a diagram it does not list is rendered unsized, with a warning
 * @returns {RenderPack}
 */
export function editorialPack({ assetPrefix, chartData, strictCharts, diagramSizes }: {
    assetPrefix: string;
    chartData?: ((src: string, context: {
        file: string;
    }) => string | Promise<string>) | undefined;
    strictCharts?: boolean | undefined;
    diagramSizes?: Record<string, {
        width: number;
        height: number;
    }> | undefined;
}): RenderPack;
export type RenderPack = {
    name: string;
    /**
     * every directive name the pack handles, so the unknown-directive guard allows them
     */
    directives: readonly string[];
    /**
     * called once per render; `result` is merged into what render returns, and `warn` adds to its warnings
     */
    setup: (context: {
        file: string;
        body: string;
        warn: (warning: {
            line: number | null;
            message: string;
        }) => void;
    }) => {
        remark: Array<[unknown, ...unknown[]]>;
        rehype: Array<[unknown, ...unknown[]]>;
        result?: () => Record<string, unknown>;
    };
};
