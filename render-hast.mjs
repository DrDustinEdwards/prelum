// The two hast node builders the chart and diagram renderers write their figures with, and the HTML reader the chart and the
// Markdown copy build hast with.

import { h as hast, s } from "hastscript";
import { Parser } from "htmlparser2";

/** @param {string} tagName @param {Record<string, unknown>} properties @param {unknown[]} children */
export const h = (tagName, properties, children) => ({
  type: "element",
  tagName,
  properties,
  children,
});

/** @param {string} value */
export const text = (value) => ({ type: "text", value });

/**
 * HTML as a hast tree, the way `hast-util-from-html` builds it but read by htmlparser2 instead of parse5, whose spec-exact
 * tree building costs about 30 KiB gzip of every Worker. For HTML this package or the site wrote, so well formed: htmlparser2
 * decodes entities, closes the tags a browser would imply and gives SVG tag names their case; hastscript maps each attribute
 * to its hast property, in the SVG schema inside <svg> (but not inside its <foreignObject>).
 *
 * @param {string} html
 * @returns {import("hast").Root}
 */
export function fromHtml(html) {
  /** @type {import("hast").Root} */
  const root = { type: "root", children: [] };
  /** @type {(import("hast").Root | import("hast").Element)[]} */
  const open = [root];
  /** Whether each open element's children are SVG. */
  const svg = [false];
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        const inSvg =
          name === "svg" || (/** @type {boolean} */ (svg.at(-1)) && name !== "foreignObject");
        const element = (inSvg ? s : hast)(name, attributes);
        /** @type {(import("hast").Root | import("hast").Element)} */ (open.at(-1)).children.push(
          element,
        );
        open.push(element);
        svg.push(inSvg && name !== "foreignObject");
      },
      onclosetag() {
        open.pop();
        svg.pop();
      },
      ontext(value) {
        const siblings = /** @type {(import("hast").Root | import("hast").Element)} */ (open.at(-1))
          .children;
        const last = siblings.at(-1);
        if (last?.type === "text") last.value += value;
        else siblings.push({ type: "text", value });
      },
      oncomment(value) {
        /** @type {(import("hast").Root | import("hast").Element)} */ (open.at(-1)).children.push({
          type: "comment",
          value,
        });
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );
  parser.end(html);
  return root;
}
