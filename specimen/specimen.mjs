// The specimen's elements: each is a short markdown file in specimen/elements, rendered here exactly as a site configured like
// dustinedwards-info renders it (the editorial pack and code highlighting on). The site build (specimen/build.mjs) and the tests
// (test/specimen.test.mjs) both read the elements through this file, so the page, the stored expected output and the index Carrel
// reads cannot drift apart.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { render } from "../render.mjs";
import { CORE_DIRECTIVES } from "../render-directives.mjs";
import { createHighlight } from "../render-highlight.mjs";
import { editorialPack } from "../render-packs.mjs";

const ELEMENTS_DIR = new URL("./elements/", import.meta.url);
export const EXPECTED_DIR = new URL("./expected/", import.meta.url);

/** The specimen's own address. The feed form of each element is absolutised against it. */
export const ORIGIN = "https://prelum.dustinedwards.info";

/** The prefix of the diagram assets in specimen/diagrams. */
export const ASSET_PREFIX = "prelum-";

const editorial = editorialPack({ assetPrefix: ASSET_PREFIX });

/** The directive packs a source can need, by the name the index gives them. */
export const PACKS = {
  core: CORE_DIRECTIVES,
  editorial: editorial.directives,
};

export const options = {
  packs: [editorial],
  highlight: createHighlight(),
  // The specimen shows only what the pipeline's own allowlist permits.
  assertSafe: true,
};

/**
 * The specimen's images are files in specimen/static/images named <name>-<width>x<height>.<ext>.
 *
 * @param {string} src
 */
export async function resolveImage(src) {
  const size = /-(\d+)x(\d+)\.\w+$/.exec(src);
  if (!size) throw new Error(`specimen image ${src} does not carry its size in its name (<name>-<width>x<height>.<ext>)`);
  return { width: Number(size[1]), height: Number(size[2]) };
}

/**
 * @typedef {object} Element
 * @property {string} id the file name without its order prefix, used as the page anchor and the expected-output name
 * @property {string} file the file name in specimen/elements
 * @property {string} name
 * @property {string} summary
 * @property {string} source the markdown, without the header
 * @property {string[]} directives the directives the source uses
 * @property {"core" | "editorial"} pack the pack a site must configure to render the source
 */

/**
 * A header of `key: value` lines between two `---` lines; the specimen needs no more of YAML than that.
 *
 * @param {string} file
 * @param {string} text
 * @param {readonly string[]} [required] the keys the header must carry
 */
export function splitHeader(file, text, required = ["name", "summary"]) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!match) throw new Error(`${file}: an element starts with a --- header naming it`);
  /** @type {Record<string, string>} */
  const header = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const at = line.indexOf(": ");
    if (at < 1) throw new Error(`${file}: header line ${JSON.stringify(line)} is not "key: value"`);
    header[line.slice(0, at)] = line.slice(at + 2).trim();
  }
  for (const key of required) {
    if (!header[key]) throw new Error(`${file}: the header has no ${key}`);
  }
  return { header, source: text.slice(match[0].length) };
}

/**
 * The directives a source uses, read from its parse rather than its text. Prose such as 12:30 parses as a directive named 30,
 * which the renderer turns back into text, so only names that start with a letter count.
 *
 * @param {string} file
 * @param {string} source
 */
function directivesOf(file, source) {
  const tree = unified().use(remarkParse).use(remarkDirective).parse(source);
  /** @type {Set<string>} */
  const names = new Set();
  visit(tree, (node) => {
    if (node.type === "containerDirective" || node.type === "leafDirective" || node.type === "textDirective") {
      if (/^[a-z]/i.test(node.name)) names.add(node.name);
    }
  });
  const known = [...PACKS.core, ...PACKS.editorial];
  for (const name of names) {
    if (!known.includes(name)) throw new Error(`${file}: :${name} is not a directive Prelum handles`);
  }
  return [...names].sort();
}

/** @returns {Element[]} in file order */
export function loadElements() {
  const files = readdirSync(ELEMENTS_DIR).filter((f) => f.endsWith(".md")).sort();
  /** @type {Set<string>} */
  const ids = new Set();
  return files.map((file) => {
    const order = /^(\d+)-([a-z0-9-]+)\.md$/.exec(file);
    if (!order) throw new Error(`${file}: an element file is named <order>-<id>.md`);
    const id = /** @type {string} */ (order[2]);
    if (ids.has(id)) throw new Error(`${file}: the id ${id} is used twice`);
    ids.add(id);
    const { header, source } = splitHeader(file, readFileSync(new URL(file, ELEMENTS_DIR), "utf8"));
    const directives = directivesOf(file, source);
    const pack = directives.some((d) => PACKS.editorial.includes(d)) ? "editorial" : "core";
    return {
      id,
      file,
      name: /** @type {string} */ (header.name),
      summary: /** @type {string} */ (header.summary),
      source,
      directives,
      pack,
    };
  });
}

/** @param {Element} element */
export function renderElement(element) {
  return render({ file: `specimen/elements/${element.file}`, body: element.source, resolveImage, options });
}

/**
 * The machine-readable index of the elements: what Carrel's Insert menu reads. Generated from the sources, never written by hand.
 *
 * @param {readonly Element[]} elements
 * @param {string} version Prelum's version
 */
export function elementIndex(elements, version) {
  return {
    prelum: version,
    elements: elements.map((e) => ({
      id: e.id,
      name: e.name,
      summary: e.summary,
      markdown: e.source.trimEnd(),
      pack: e.pack,
      directives: e.directives,
    })),
  };
}

/** @param {string} id */
export function expectedPath(id) {
  return new URL(`${id}.html`, EXPECTED_DIR);
}

/** Beside the drawings in specimen/diagrams: the configuration they were drawn with. */
export const DIAGRAM_CONFIG_FILE = "config.json";

/**
 * The diagram colors of one theme, by role, read from Capsomer's generated color.css: the light theme is the first :root
 * block, the dark one the [data-theme="dark"] block.
 *
 * @param {"light" | "dark"} theme
 */
export function diagramColors(theme) {
  const tokensCss = pathToFileURL(createRequire(import.meta.url).resolve("capsomer/tokens.css"));
  // Capsomer 0.21.0 renamed tokens/colour.css to color.css; the old name serves the Capsomer pinned before it. codespell:ignore colour
  const file = [new URL("../tokens/color.css", tokensCss), new URL("../tokens/colour.css", tokensCss)].find((url) => existsSync(url)); // codespell:ignore colour
  const css = readFileSync(/** @type {URL} */ (file), "utf8");
  const start = theme === "light" ? css.indexOf(":root {") : css.indexOf(':root[data-theme="dark"] {');
  if (start < 0) throw new Error(`Capsomer's color.css has no ${theme} block`);
  const block = css.slice(start, css.indexOf("}", start));
  /** @type {Record<string, string>} */
  const tokens = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) tokens[name ?? ""] = value ?? "";
  /** @type {Record<string, string>} */
  const colors = {};
  for (const [role, token] of Object.entries(DIAGRAM_TOKENS)) {
    if (!tokens[token]) throw new Error(`Capsomer's color.css has no --${token} in the ${theme} theme`);
    colors[role] = tokens[token];
  }
  return colors;
}

/** Capsomer's token for each diagram color role (DIAGRAM_ROLE_NAMES in render-diagram-draw.mjs). */
const DIAGRAM_TOKENS = {
  paper: "surface",
  raised: "raised",
  text: "text",
  heading: "text",
  border: "line",
  borderStrong: "line-strong",
  tint: "accent-soft",
  onAccent: "primary-fg",
  danger: "crit",
  dangerTint: "crit-soft",
};

/**
 * What the diagrams are drawn with: the Mermaid version and each theme's colors from Capsomer's tokens. specimen/diagrams.mjs
 * stores it beside the drawings, and the build refuses drawings made with anything else, so a Capsomer color change cannot
 * leave the diagrams in the old palette.
 */
export function diagramConfig() {
  const mermaid = JSON.parse(readFileSync(new URL("../node_modules/@mermaid-js/mermaid-cli/package.json", import.meta.url), "utf8")).version;
  return { mermaidCli: mermaid, light: diagramColors("light"), dark: diagramColors("dark") };
}
