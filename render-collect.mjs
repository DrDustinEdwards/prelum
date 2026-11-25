// The passes that read a rendered body for its table of contents, unique heading ids, excerpt and word count.

import { toString as hastToString } from "hast-util-to-string";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";

import { excerpt, wordCount } from "./text.mjs";

/**
 * @param {Array<{ depth: number, id: string, text: string }>} sink
 */
export function rehypeCollectToc(sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = String(node.properties?.id ?? "");
      if (!id) return;
      // remark-gfm emits a visually hidden "Footnotes" heading to label its section. It is not part of the outline a reader navigates.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("sr-only")) return;
      sink.push({
        depth: node.tagName === "h2" ? 2 : 3,
        id,
        // Collected before the autolink appends its "#", so a trailing "#" here is the heading's own ("Learning C#").
        text: hastToString(node).trim(),
      });
    });
  };
}

/**
 * rehype-slug, then every id it wrote made unique against every other id in the tree: a sidenote's `sn-1`, the footnotes heading's
 * `footnote-label`, any id a plugin wrote. rehype-slug alone only avoids the headings it slugged, so an author's heading "Sn 1" or
 * "Footnote label" shared an id with those (a duplicate id breaks #links, aria-labelledby and axe `duplicate-id`). The author's heading
 * gives way: it becomes `sn-1-1`.
 */
export function rehypeUniqueSlug() {
  const slug = rehypeSlug();
  return (/** @type {import("hast").Root} */ tree) => {
    /** @type {Array<import("hast").Element>} */
    const slugged = [];
    visit(tree, "element", (node) => {
      if (/^h[1-6]$/.test(node.tagName) && !node.properties?.id) slugged.push(node);
    });
    slug(tree);
    const mine = new Set(slugged);
    const taken = new Set();
    visit(tree, "element", (node) => {
      const id = node.properties?.id;
      if (typeof id === "string" && !mine.has(node)) taken.add(id);
    });
    const wanted = new Set(slugged.map((node) => String(node.properties?.id)));
    for (const node of slugged) {
      const base = String(node.properties?.id);
      let id = base;
      for (let n = 1; taken.has(id) || (id !== base && wanted.has(id)); n += 1) id = `${base}-${n}`;
      node.properties.id = id;
      taken.add(id);
      wanted.add(id);
    }
  };
}

/**
 * The reading facts, counted from the rendered tree so they are the words a reader sees: no markdown syntax, no directive attributes.
 * Runs before the autolinks append their "#" and before KaTeX doubles each expression.
 *
 * @param {{ words: number, images: number, excerpt: string }} sink
 */
export function rehypeCollectText(sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    /** @type {string[]} */
    const parts = [];
    /** @param {any} node */
    const walk = (node) => {
      if (node.type === "text") parts.push(node.value);
      if (node.type !== "element" && node.type !== "root") return;
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("sr-only")) return;
      // The pull quote's raised copy is the sentence again, for the eye only: it is not text a reader reads twice or a word counted twice.
      if (node.properties?.["aria-hidden"] === "true" || node.properties?.ariaHidden === "true")
        return;
      if (node.tagName === "img" && !classes.includes?.("figure-dark")) sink.images += 1;
      for (const child of node.children ?? []) {
        walk(child);
        if (child.type === "element") parts.push(" ");
      }
    };
    walk(tree);
    sink.words = wordCount(parts.join(""));
    const lead = tree.children.find(
      (child) =>
        child.type === "element" &&
        child.tagName === "p" &&
        child.properties?.["aria-hidden"] !== "true" &&
        child.properties?.ariaHidden !== "true",
    );
    sink.excerpt = lead ? excerpt(hastToString(lead), 300) : "";
  };
}
