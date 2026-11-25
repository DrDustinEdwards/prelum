// The rehype passes that make a table, a code block and a task list readable and operable: scroll regions with names, empty header
// cells, code languages and the labels of task-list checkboxes.

import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

/**
 * A box that can scroll sideways is a named region keyboard users can focus (Adrian Roselli's pattern): tabindex so they can scroll it,
 * role=region because ARIA prohibits aria-label on a generic div or pre, and a name so the region is not noise. Capsomer's sweep fails
 * a sideways-scrolling box without all three.
 *
 * @param {import("hast").Element} node
 * @param {string} name
 */
function scrollRegion(node, name) {
  node.properties = { ...node.properties, tabIndex: 0, role: "region", ariaLabel: name };
  scrollRegions.add(node);
}

/** Every region scrollRegion made, so rehypeCodeRegions can tell two with one name apart. */
const scrollRegions = new WeakSet();

/** The first four header names, so a wide table's name stays short. Read when the table is wrapped, before KaTeX writes a formula twice. */
const TABLE_NAME_HEADERS = 4;

/** @param {import("hast").Element} table */
function tableName(table) {
  /** @type {import("hast").Element | undefined} */
  let row;
  visit(table, "element", (node) => {
    if (node.tagName !== "tr") return;
    row = node;
    return false;
  });
  const headers = (row?.children ?? [])
    .filter((cell) => cell.type === "element" && cell.tagName === "th")
    .map((cell) => hastToString(cell).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (headers.length === 0) return "Table";
  const more = headers.length > TABLE_NAME_HEADERS ? ", …" : "";
  return `Table: ${headers.slice(0, TABLE_NAME_HEADERS).join(", ")}${more}`;
}

/**
 * A header cell with no content (the top-left corner of a comparison table, `| | A | B |`) is a table header with no name:
 * axe `empty-table-header`, and a screen reader announces the column with nothing. W3C WAI's tables tutorial says a corner
 * that names nothing is a plain cell, so it becomes a `td`.
 */
export function rehypeEmptyHeaders() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "th" || hastToString(node).trim() !== "") return;
      if (node.children.some((child) => child.type === "element")) return;
      node.tagName = "td";
      delete node.properties?.scope;
    });
  };
}

/** A wrapper, not display: block on the table, which can strip the table role from a screen reader. */
export function rehypeTableScroll() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      if (parent.type === "element" && parent.properties?.className?.includes?.("table-scroll"))
        return;
      const wrapper = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [node],
      };
      scrollRegion(/** @type {import("hast").Element} */ (wrapper), tableName(node));
      parent.children[index] = /** @type {import("hast").Element} */ (wrapper);
    });
  };
}

/** Readable names for the fence languages render-highlight.mjs ships and their usual aliases; any other is named as written. */
const LANGUAGE_NAMES = /** @type {Record<string, string>} */ ({
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  css: "CSS",
  html: "HTML",
  javascript: "JavaScript",
  js: "JavaScript",
  json: "JSON",
  markdown: "Markdown",
  md: "Markdown",
  python: "Python",
  py: "Python",
  sql: "SQL",
  tsx: "TSX",
  typescript: "TypeScript",
  ts: "TypeScript",
});

/** @param {import("hast").Element} pre */
function codeLanguageName(pre) {
  // render-highlight.mjs writes data-lang ("text" when there is none), as a raw key; without it the language is the code's class.
  const code = pre.children.find((child) => child.type === "element" && child.tagName === "code");
  const classes = code?.type === "element" ? [code.properties?.className ?? []].flat() : [];
  const fromClass = String(
    classes.find((name) => String(name).startsWith("language-")) ?? "",
  ).slice("language-".length);
  const lang = String(
    pre.properties?.["data-lang"] ?? pre.properties?.dataLang ?? fromClass,
  ).trim();
  if (!lang || lang === "text") return "Code";
  return `Code: ${LANGUAGE_NAMES[lang.toLowerCase()] ?? lang}`;
}

/** @param {import("hast").Element} pre @param {string} name */
function codeRegion(pre, name) {
  // shiki writes its own tabindex under the raw key, which would print a second one beside tabIndex.
  delete pre.properties.tabindex;
  scrollRegion(pre, name);
}

/**
 * Two regions with one name are one landmark name twice (axe landmark-unique, ARIA Authoring Practices: landmarks of one role
 * need distinct names), so a name used more than once on a page gets " (n of N)". A name used once is left as it is.
 * @param {import("hast").Root} tree
 */
function uniqueRegionNames(tree) {
  /** @type {import("hast").Element[]} */
  const regions = [];
  visit(tree, "element", (node) => {
    if (scrollRegions.has(node)) regions.push(node);
  });
  /** @type {Map<string, import("hast").Element[]>} */
  const byName = new Map();
  for (const node of regions) {
    const name = String(node.properties?.ariaLabel ?? "");
    byName.set(name, [...(byName.get(name) ?? []), node]);
  }
  for (const [name, nodes] of byName) {
    if (nodes.length < 2) continue;
    nodes.forEach((node, i) => {
      node.properties = { ...node.properties, ariaLabel: `${name} (${i + 1} of ${nodes.length})` };
    });
  }
}

/**
 * After the highlighter, so its output is named too. shiki swaps each pre for a root holding the new one, so a framed block's pre is
 * found under its figure, not as the figure's child.
 */
export function rehypeCodeRegions() {
  return (/** @type {import("hast").Root} */ tree) => {
    /** @type {Set<import("hast").Element>} */
    const framed = new Set();
    visit(tree, "element", (figure) => {
      if (figure.tagName !== "figure" || !figure.properties?.className?.includes?.("code-frame"))
        return;
      const caption = figure.children.find(
        (child) =>
          child.type === "element" &&
          child.tagName === "figcaption" &&
          child.properties?.className?.includes?.("code-title"),
      );
      const title = caption ? hastToString(caption).trim() : "";
      visit(figure, "element", (pre) => {
        if (pre.tagName !== "pre") return;
        framed.add(pre);
        codeRegion(pre, title ? `Code: ${title}` : codeLanguageName(pre));
      });
    });
    visit(tree, "element", (pre) => {
      if (pre.tagName === "pre" && !framed.has(pre)) codeRegion(pre, codeLanguageName(pre));
    });
    uniqueRegionNames(tree);
  };
}

/**
 * remark-gfm emits a task-list checkbox with no name, which axe fails as critical. A <label> wraps the checkbox and the item's first
 * line, the inline content after it up to the first block (a nested list, a paragraph, a table). The name is then what the reader
 * sees once rendered (math, links, an image's alt), read once, and a loose item's later paragraphs stay out of it.
 */
const BLOCK_TAGS = new Set([
  "blockquote",
  "details",
  "div",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

export function rehypeTaskListLabels() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (item) => {
      if (item.tagName !== "li" || !item.properties?.className?.includes?.("task-list-item"))
        return;
      // The checkbox is first in the item, or first in its paragraph when the list is loose.
      const first = item.children.find((child) => child.type === "element");
      const line = first?.tagName === "p" ? first : item;
      const at = line.children.findIndex((child) => child.type === "element");
      const checkbox = line.children[at];
      if (
        checkbox?.type !== "element" ||
        checkbox.tagName !== "input" ||
        checkbox.properties?.type !== "checkbox"
      )
        return;
      let end = at + 1;
      while (end < line.children.length) {
        const child = line.children[end];
        if (child.type === "element" && BLOCK_TAGS.has(child.tagName)) break;
        end += 1;
      }
      // Trailing whitespace before a nested list stays outside the label.
      while (end > at + 1) {
        const last = line.children[end - 1];
        if (last.type !== "text" || last.value.trim() !== "") break;
        end -= 1;
      }
      const label = {
        type: "element",
        tagName: "label",
        properties: {},
        children: line.children.slice(at, end),
      };
      line.children.splice(at, end - at, /** @type {import("hast").Element} */ (label));
    });
  };
}
