// A page's HTML as Markdown: the reading text of the page, links made absolute, the site's own chrome dropped. Needs `htmlparser2`,
// `hastscript`, `hast-util-to-mdast`, `mdast-util-to-markdown` and `mdast-util-gfm`, optional peers.

import { toMdast } from "hast-util-to-mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

import { fromHtml } from "./render-hast.mjs";

/** @typedef {import("hast").Root | import("hast").Element} Parent */

/**
 * @typedef {object} MarkdownCopy
 * @property {string} title the page's name: `og:title`, else `<title>`, else its first heading
 * @property {string} description the meta description, or ""
 * @property {string | undefined} canonical the canonical link, absolute
 * @property {boolean} noindex the page asks search engines to leave it out
 * @property {string} markdown the body of the page's `<main>` (or `<body>`) as Markdown, its headings from `##`
 */

/** Elements that carry no reading text: scripts, styles, controls, the site's own navigation, players and drawings. */
const DROPPED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "svg",
  "canvas",
  "nav",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "dialog",
  "iframe",
  "video",
  "audio",
  "object",
  "embed",
]);

/** @param {import("hast").Element} node @param {string} name */
const prop = (node, name) => {
  const value = node.properties?.[name];
  return Array.isArray(value)
    ? value.join(" ")
    : value === undefined || value === null
      ? undefined
      : String(value);
};

/** @param {import("hast").Nodes} node @returns {string} */
export const text = (node) =>
  node.type === "text"
    ? node.value
    : "children" in node
      ? node.children.map((child) => text(/** @type {import("hast").Nodes} */ (child))).join("")
      : "";

/**
 * The first element that passes `test`, depth first.
 * @param {Parent} node
 * @param {(element: import("hast").Element) => boolean} test
 * @returns {import("hast").Element | undefined}
 */
export function find(node, test) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (test(child)) return child;
    const found = find(child, test);
    if (found) return found;
  }
  return undefined;
}

/**
 * Drops what a reader would not read (DROPPED, anything hidden), in place.
 * @param {Parent} node
 */
function prune(node) {
  node.children = node.children.filter((child) => {
    if (child.type === "comment") return false;
    if (child.type !== "element") return true;
    if (DROPPED.has(child.tagName)) return false;
    if (child.properties?.hidden !== undefined && child.properties.hidden !== false) return false;
    if (prop(child, "ariaHidden") === "true" || child.properties?.inert) return false;
    prune(child);
    return true;
  });
}

/**
 * Link and image addresses made absolute, and the headings shifted so the body's start at `##` (`markdownPage` writes the
 * title as the one `#`). A `data:` link (a chart's CSV download) is no address an agent can follow, so it keeps only its text.
 * @param {import("mdast").Nodes} node
 * @param {string} base
 */
function settle(node, base) {
  if ((node.type === "link" || node.type === "image" || node.type === "definition") && node.url) {
    try {
      node.url = new URL(node.url, base).href;
    } catch {
      // An address URL cannot read is kept as written.
    }
  }
  if (node.type === "heading" && node.depth === 1) node.depth = 2;
  if (!("children" in node)) return;
  /** @type {any[]} */
  const children = node.children;
  node.children = /** @type {any} */ (
    children.flatMap((child) =>
      child.type === "link" && child.url.startsWith("data:") ? child.children : [child],
    )
  );
  for (const child of node.children) settle(child, base);
}

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
export function htmlToMarkdown(html, { base } = {}) {
  const tree = fromHtml(html);
  const head = find(tree, (element) => element.tagName === "head");
  const meta = (/** @type {string} */ key, /** @type {string} */ value) =>
    head
      ? find(
          head,
          (element) => element.tagName === "meta" && prop(element, key)?.toLowerCase() === value,
        )
      : undefined;
  const titleElement = head && find(head, (element) => element.tagName === "title");
  const canonicalElement =
    head &&
    find(
      head,
      (element) =>
        element.tagName === "link" &&
        (prop(element, "rel") ?? "").split(/\s+/).includes("canonical"),
    );
  const href = canonicalElement && prop(canonicalElement, "href");
  const canonical = href && base ? absoluteHref(href, base) : href;
  const metaContent = (/** @type {string} */ key, /** @type {string} */ value) => {
    const found = meta(key, value);
    return found && prop(found, "content");
  };

  const main =
    find(tree, (element) => element.tagName === "main") ??
    find(tree, (element) => element.tagName === "body") ??
    tree;
  prune(main);
  const h1 = find(main, (element) => element.tagName === "h1");
  const title =
    metaContent("property", "og:title") ||
    (titleElement && text(titleElement).trim()) ||
    (h1 && text(h1).trim()) ||
    "";
  if (h1) {
    /** @param {Parent} node @returns {boolean} */
    const remove = (node) => {
      const at = node.children.indexOf(h1);
      if (at >= 0) {
        node.children.splice(at, 1);
        return true;
      }
      return node.children.some((child) => child.type === "element" && remove(child));
    };
    remove(main);
  }
  const mdast = toMdast(main);
  settle(mdast, canonical ?? base ?? "https://invalid.example/");
  const markdown = collapseBlankLines(
    toMarkdown(mdast, {
      extensions: [gfmToMarkdown()],
      bullet: "-",
      emphasis: "_",
      rule: "-",
    }),
  ).trim();
  return {
    title: title.replace(/\s+/g, " ").trim(),
    description: (metaContent("name", "description") ?? "").replace(/\s+/g, " ").trim(),
    canonical,
    noindex: /\bnoindex\b/i.test(metaContent("name", "robots") ?? ""),
    markdown,
  };
}

/**
 * Runs of blank lines become one, except inside a fenced code block, where they are the code's own.
 *
 * @param {string} markdown
 */
function collapseBlankLines(markdown) {
  /** @type {string[]} */
  const out = [];
  let fence = "";
  let blanks = 0;
  for (const line of markdown.split("\n")) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = "";
    } else if (marker) {
      fence = marker;
    }
    blanks = !fence && line.trim() === "" ? blanks + 1 : 0;
    if (blanks <= 1 || fence) out.push(line);
  }
  return out.join("\n");
}

/**
 * @param {string} href @param {string} base
 * @returns {string | undefined} undefined when either is not a URL, so a malformed canonical is ignored
 */
function absoluteHref(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return undefined;
  }
}
