/**
 * Valueless attributes are dropped: they are indistinguishable from absent ones.
 *
 * @param {{ attributes?: Record<string, string | null | undefined> | null | undefined }} node
 * @returns {Record<string, string>}
 */
export function attributesOf(node: {
    attributes?: Record<string, string | null | undefined> | null | undefined;
}): Record<string, string>;
/**
 * @param {string} file
 */
export function remarkFigure(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * remark-directive parses prose such as 4.5:1 and localhost:8080 as directives, and every real directive name is a word. Sliced from
 * the source so a label or attributes come back as written.
 *
 * @param {string} source the markdown these positions refer to
 */
export function remarkNumericTextDirectives(source: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * Refuses a heading directly inside a container directive, naming the directive and the line.
 *
 * @param {string} file
 * @param {any} node the directive
 * @param {string} why completes the sentence that names the heading
 */
export function refuseHeading(file: string, node: any, why: string): void;
/**
 * A heading inside is refused: it would put a hidden section in the table of contents. Native
 * <details>, so the text is in the HTML without script.
 *
 * @param {string} file
 */
export function remarkDetails(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * An unhandled directive becomes a silent empty <div>, so a typo such as :::figrue loses the figure. Runs after
 * remarkNumericTextDirectives, so prose like 12:30 is already text.
 *
 * @param {string} file
 * @param {readonly string[]} known every directive name the renderer and its packs handle
 */
export function remarkUnknownDirectives(file: string, known: readonly string[]): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * Split across remark and rehype: validation must fail the build in remark, but the caption only
 * becomes hast after remark-rehype. The remark half of a model directive: a container holding
 * exactly one fenced block, built into a model and marked with the model's index for the rehype half.
 *
 * @param {{
 *   name: string,
 *   marker: string,
 *   className: string,
 *   what: string,
 *   lang?: string,
 *   build: (attributes: any, source: string) => any,
 * }} kind `what` names the fence's content in the refusal; `lang` is the fence language required, if any
 */
export function remarkModelDirective(kind: {
    name: string;
    marker: string;
    className: string;
    what: string;
    lang?: string;
    build: (attributes: any, source: string) => any;
}): (file: string, sink: any[]) => (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * The rehype half: renders each marked figure from its model and drops the marker.
 *
 * @param {string} marker
 * @param {(model: any, caption: any[], node: any) => any[]} render
 */
export function rehypeModelMarker(marker: string, render: (model: any, caption: any[], node: any) => any[]): (models: any[]) => (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/** The directives the core handles itself. A pack adds its own names to the list the guard checks. */
export const CORE_DIRECTIVES: string[];
