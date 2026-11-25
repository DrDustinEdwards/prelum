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
export type MarkdownCopy = {
    /**
     * the page's name: `og:title`, else `<title>`, else its first heading
     */
    title: string;
    /**
     * the meta description, or ""
     */
    description: string;
    /**
     * the canonical link, absolute
     */
    canonical: string | undefined;
    /**
     * the page asks search engines to leave it out
     */
    noindex: boolean;
    /**
     * the body of the page's `<main>` (or `<body>`) as Markdown, its headings from `##`
     */
    markdown: string;
};
