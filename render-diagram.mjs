// Draws nothing: diagram layout needs real font metrics, which no DOM shim in a Worker provides, so
// the site's build renders assets ahead of time and the HTML carries only the key and source.

import { h, text } from "./render-hast.mjs";

// Bump when the token map, the site's color tokens or the mermaid version changes: the key hashes
// only the source, so a restyle without a bump leaves every rendered asset at the old colors forever.
const DIAGRAM_TEMPLATE_VERSION = 1;

/**
 * FNV-1a, 32 bits, over UTF-16 code units: a short stable fingerprint, not a security boundary.
 *
 * @param {string} input
 * @returns {string} eight lowercase hex digits
 */
function fnv1a32(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export const DIAGRAM_ASSET_DIR = "diagrams";

export const DIAGRAM_THEMES = ["light", "dark"];

/** The file drawDiagrams writes beside the drawings: each drawing's width and height, by file name, for the renderer to size it. */
export const DIAGRAM_SIZES_FILE = "sizes.json";

/**
 * Posts check out as LF and the rest of the tree as CRLF; without this, clones on different OSes
 * compute different keys for the same diagram.
 *
 * @param {string} source
 */
function normalizeDiagramSource(source) {
  return source.replace(/\r\n/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
}

/**
 * @param {string} source the mermaid source, unnormalised
 */
function diagramKey(source) {
  const input = `${DIAGRAM_TEMPLATE_VERSION}\n${normalizeDiagramSource(source)}`;
  return fnv1a32(input);
}

/**
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 * @param {string} assetPrefix the site's asset name prefix, for example "example-"
 */
export function diagramAssetPath(key, theme, assetPrefix) {
  return `/${DIAGRAM_ASSET_DIR}/${assetPrefix}${key}-${theme}.svg`;
}

/**
 * @param {Record<string, string>} attrs
 * @param {string} source the fenced mermaid block's contents
 */
export function buildDiagramModel(attrs, source) {
  // The alt must name the boxes and arrows: there is no generated equivalent like a chart's data table.
  const alt = (attrs.alt ?? "").trim();
  if (!alt) {
    throw new Error(`:::diagram "${attrs.title ?? "untitled"}" requires an alt attribute`);
  }

  const normalized = normalizeDiagramSource(source);
  if (!normalized) throw new Error(":::diagram source is empty");

  return {
    alt,
    title: (attrs.title ?? "").trim(),
    source: normalized,
    key: diagramKey(source),
  };
}

/**
 * Two images switched by display: none in the site's stylesheet, because an <img> SVG cannot see the page's custom
 * properties and the theme comes from a cookie, not prefers-color-scheme. Each is sized from its drawing, as `sizes`
 * (the site's DIAGRAM_SIZES_FILE) records it, so nothing shifts as it loads; a diagram not drawn yet is unsized until
 * the body is rendered again. Lazy, since a diagram is rarely the first thing a page shows, and role="img", which
 * VoiceOver needs to announce an SVG in an <img> by its alt.
 *
 * @param {string} assetPrefix the site's asset name prefix
 * @param {Record<string, { width: number, height: number }>} [sizes] each drawing's size, by file name
 * @returns {(model: ReturnType<typeof buildDiagramModel>, captionChildren: any[]) => any[]} the rehype renderer
 *   `captionChildren` is hast for an author-written caption, may be empty
 */
export const renderDiagramHast = (assetPrefix, sizes = {}) => (model, captionChildren) => {
  /** @type {any[]} */
  const children = [];

  if (model.title) {
    // A <p>, not a heading: rehypeCollectToc would put diagram titles in the table of contents.
    children.push(h("p", { className: ["diagram-title"] }, [text(model.title)]));
  }

  for (const theme of DIAGRAM_THEMES) {
    const src = diagramAssetPath(model.key, theme, assetPrefix);
    const size = diagramSize(sizes, src);
    children.push(
      h("img", {
        className: ["diagram-image", `diagram-${theme}`],
        src,
        alt: model.alt,
        role: "img",
        ...(size ? { width: size.width, height: size.height } : {}),
        loading: "lazy",
        decoding: "async",
      }, []),
    );
  }

  if (captionChildren.length > 0) {
    children.push(h("figcaption", {}, captionChildren));
  }

  return children;
};

/**
 * A drawing's size from the site's sizes file, or null when it is not drawn yet.
 *
 * @param {Record<string, { width: number, height: number }>} sizes
 * @param {string} src the asset path diagramAssetPath gives
 */
export function diagramSize(sizes, src) {
  const size = sizes[src.slice(src.lastIndexOf("/") + 1)];
  return size && size.width > 0 && size.height > 0 ? size : null;
}
