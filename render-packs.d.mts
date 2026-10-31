/**
 * Uppercased so two spellings of one color render the same bytes. The chip is aria-hidden because the
 * code-span label is the second channel. The inline --swatch style is already permitted by
 * style-src-attr 'unsafe-inline' in the site's CSP, which a site using this pack must allow.
 *
 * @param {string} file
 */
export function remarkSwatch(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * Stays in the prose flow and the site's stylesheet floats it into the rail: that aligns it with its paragraph
 * without measuring, on a plane that does not hydrate.
 *
 * @param {string} file
 */
export function remarkSidenote(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * Marks a sentence already in the prose instead of duplicating it, so the .md twin, which serves the
 * source verbatim, has it once. The raised copy is aria-hidden so a screen reader hears it once.
 *
 * @param {string} file
 */
export function remarkPullQuote(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * `:::chart{src="..."}` (E3): the CSV comes from the site's `chartData(src, { file })`, called at render time, in place of the
 * fenced block. Prelum fetches nothing itself, so without the hook a `src` is refused; with it, the text it returns is the block.
 *
 * @param {string} file
 * @param {((src: string, context: { file: string }) => string | Promise<string>) | undefined} chartData
 */
export function remarkChartSource(file: string, chartData: ((src: string, context: {
    file: string;
}) => string | Promise<string>) | undefined): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => Promise<void>;
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
 * dustinedwards-info's directives, in the order its renderer ran them, so the output is the same bytes.
 *
 * @param {object} options
 * @param {string} options.assetPrefix the prefix of the site's diagram assets, for example "example-"
 * @param {(src: string, context: { file: string }) => string | Promise<string>} [options.chartData] reads the CSV a
 *   `:::chart{src="..."}` cites (a URL or a media path), at render time; without it a `src` is refused
 * @param {boolean} [options.strictCharts] refuse a chart with no title, author text above reading grade 9 or too many
 *   series, where the default renders it with a warning (E4)
 * @returns {RenderPack}
 */
export function editorialPack({ assetPrefix, chartData, strictCharts }: {
    assetPrefix: string;
    chartData?: (src: string, context: {
        file: string;
    }) => string | Promise<string>;
    strictCharts?: boolean;
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
