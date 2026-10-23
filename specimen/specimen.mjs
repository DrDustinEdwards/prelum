// The specimen's elements: each is a short markdown file in specimen/elements, rendered here exactly as a site configured like
// dustinedwards-info renders it (the editorial pack and code highlighting on). The site build (specimen/build.mjs) and the tests
// (test/specimen.test.mjs) both read the elements through this file, so the page, the stored expected output and the index Carrel
// reads cannot drift apart.

import { readdirSync, readFileSync } from "node:fs";
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
 * The colour tokens of one theme, read from Capsomer's generated colour.css: the light theme is the first :root block, the dark
 * one the [data-theme="dark"] block.
 *
 * @param {"light" | "dark"} theme
 */
function capsomerColours(theme) {
  const css = readFileSync(new URL("../tokens/colour.css", pathToFileURL(createRequire(import.meta.url).resolve("capsomer/tokens.css"))), "utf8");
  const start = theme === "light" ? css.indexOf(":root {") : css.indexOf(':root[data-theme="dark"] {');
  if (start < 0) throw new Error(`Capsomer's colour.css has no ${theme} block`);
  const block = css.slice(start, css.indexOf("}", start));
  /** @type {Record<string, string>} */
  const tokens = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) tokens[name ?? ""] = value ?? "";
  for (const name of ["surface", "raised", "text", "accent-soft", "accent-line", "line-strong"]) {
    if (!tokens[name]) throw new Error(`Capsomer's colour.css has no --${name} in the ${theme} theme`);
  }
  return tokens;
}

/** @param {"light" | "dark"} theme */
function mermaidConfig(theme) {
  const c = capsomerColours(theme);
  return {
    // "base" is the only built-in theme whose variables can all be overridden.
    theme: "base",
    themeVariables: {
      darkMode: theme === "dark",
      background: c.surface,
      primaryColor: c["accent-soft"],
      primaryTextColor: c.text,
      primaryBorderColor: c["accent-line"],
      secondaryColor: c.raised,
      tertiaryColor: c.raised,
      lineColor: c["line-strong"],
      textColor: c.text,
      fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif',
    },
    // Labels as text, never <foreignObject>, which an <img> does not draw.
    htmlLabels: false,
    flowchart: { htmlLabels: false, padding: 12, useMaxWidth: false },
  };
}

/**
 * What the diagrams are drawn with: Mermaid's command line and each theme's configuration, coloured from Capsomer's tokens.
 * specimen/diagrams.mjs stores it beside the drawings, and the build refuses drawings made with anything else, so a Capsomer
 * colour change cannot leave the diagrams in the old palette.
 */
export function diagramConfig() {
  return { mermaidCli: "@mermaid-js/mermaid-cli@11.16.0", light: mermaidConfig("light"), dark: mermaidConfig("dark") };
}
