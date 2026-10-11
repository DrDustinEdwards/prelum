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
 * @typedef {object} RenderPack
 * @property {string} name
 * @property {readonly string[]} directives every directive name the pack handles, so the unknown-directive guard allows them
 * @property {(context: { file: string, body: string }) => {
 *   remark: Array<[unknown, ...unknown[]]>,
 *   rehype: Array<[unknown, ...unknown[]]>,
 *   result?: () => Record<string, unknown>,
 * }} setup called once per render; `result` is merged into what render returns
 */
/**
 * dustinedwards-info's directives, in the order its renderer ran them, so the output is the same bytes.
 *
 * @param {object} options
 * @param {string} options.assetPrefix the prefix of the site's diagram assets, for example "dustin-edwards-"
 * @returns {RenderPack}
 */
export function editorialPack({ assetPrefix }: {
    assetPrefix: string;
}): RenderPack;
export type RenderPack = {
    name: string;
    /**
     * every directive name the pack handles, so the unknown-directive guard allows them
     */
    directives: readonly string[];
    /**
     * called once per render; `result` is merged into what render returns
     */
    setup: (context: {
        file: string;
        body: string;
    }) => {
        remark: Array<[unknown, ...unknown[]]>;
        rehype: Array<[unknown, ...unknown[]]>;
        result?: () => Record<string, unknown>;
    };
};
