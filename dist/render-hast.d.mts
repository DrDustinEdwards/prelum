/**
 * HTML as a hast tree, the way `hast-util-from-html` builds it but read by htmlparser2 instead of parse5, whose spec-exact
 * tree building costs about 30 KiB gzip of every Worker. For HTML this package or the site wrote, so well formed: htmlparser2
 * decodes entities, closes the tags a browser would imply and gives SVG tag names their case; hastscript maps each attribute
 * to its hast property, in the SVG schema inside <svg> (but not inside its <foreignObject>).
 *
 * @param {string} html
 * @returns {import("hast").Root}
 */
export function fromHtml(html: string): import("hast").Root;
export function h(tagName: string, properties: Record<string, unknown>, children: unknown[]): {
    type: string;
    tagName: string;
    properties: Record<string, unknown>;
    children: unknown[];
};
export function text(value: string): {
    type: string;
    value: string;
};
