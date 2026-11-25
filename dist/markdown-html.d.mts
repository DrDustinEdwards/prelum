/**
 * The first element that passes `test`, depth first.
 * @param {Parent} node
 * @param {(element: import("hast").Element) => boolean} test
 * @returns {import("hast").Element | undefined}
 */
export function find(node: Parent, test: (element: import("hast").Element) => boolean): import("hast").Element | undefined;
/**
 * A page's HTML as Markdown: the facts from its head and the text of its `<main>`, or its `<body>` when it has none. The
 * main heading is dropped (it is the title), as are scripts, styles, controls, navigation, drawings and anything hidden;
 * a chart's written description and data table stay, since they are its text. Links are made absolute against the
 * canonical URL, or `base`.
 *
 * @param {string} html
 * @param {{ base?: string }} [options]
 * @returns {MarkdownCopy}
 */
export function htmlToMarkdown(html: string, { base }?: {
    base?: string;
}): MarkdownCopy;
export function text(node: import("hast").Nodes): string;
export type Parent = import("hast").Root | import("hast").Element;
import type { MarkdownCopy } from "./markdown-copy.mjs";
