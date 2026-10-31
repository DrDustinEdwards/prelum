// Draws the assets render-diagram.mjs names: one SVG per theme, ahead of time, in Node. Layout needs real font metrics, so
// this drives Mermaid's own renderer in a headless browser; the site build then only reads the committed files. Each site
// gives its colors by role; the role map, Mermaid's configuration, the drawing and the color audit are shared here.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { renderMermaid } from "@mermaid-js/mermaid-cli";
import { parseHTML } from "linkedom";
import puppeteer from "puppeteer";

import { DIAGRAM_SIZES_FILE, DIAGRAM_THEMES, diagramAssetPath } from "./render-diagram.mjs";

/**
 * Every Mermaid theme variable a diagram paints with, by the role its color plays. Everything khroma would otherwise
 * derive is supplied; what is not still gets derived, which is why every drawing is audited rather than trusting this
 * list to be complete.
 */
export const DIAGRAM_ROLES = {
  background: "paper",
  primaryColor: "paper",
  primaryBorderColor: "borderStrong",
  primaryTextColor: "text",
  secondaryColor: "raised",
  secondaryBorderColor: "border",
  secondaryTextColor: "text",
  tertiaryColor: "tint",
  tertiaryBorderColor: "border",
  tertiaryTextColor: "text",
  lineColor: "borderStrong",
  textColor: "text",
  titleColor: "heading",
  errorBkgColor: "dangerTint",
  errorTextColor: "danger",

  mainBkg: "paper",
  nodeBorder: "borderStrong",
  nodeTextColor: "text",
  clusterBkg: "tint",
  clusterBorder: "border",
  // An edge crosses page background, so the label plate must match it or the line shows through.
  edgeLabelBackground: "paper",
  arrowheadColor: "borderStrong",

  actorBkg: "paper",
  actorBorder: "borderStrong",
  actorTextColor: "text",
  actorLineColor: "border",
  signalColor: "borderStrong",
  signalTextColor: "text",
  labelBoxBkgColor: "paper",
  labelBoxBorderColor: "borderStrong",
  labelTextColor: "text",
  loopTextColor: "text",
  noteBkgColor: "raised",
  noteBorderColor: "border",
  noteTextColor: "text",
  activationBkgColor: "raised",
  activationBorderColor: "borderStrong",
  sequenceNumberColor: "onAccent",
  altBackground: "paper",
};

/** The roles a site must color, each once per theme. */
export const DIAGRAM_ROLE_NAMES = [...new Set(Object.values(DIAGRAM_ROLES))];

/**
 * An SVG inside an `<img>` may not load external resources, so the viewer's font may differ from the one the drawing was
 * measured with, which is why the padding below is generous.
 */
const FONT_FAMILY = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Set explicitly so the bytes do not move if the tool's default does. */
const SVG_ID = "diagram";

/** Fixed, so nothing about the output depends on the machine it was built on. */
const VIEWPORT = { width: 1200, height: 800, deviceScaleFactor: 1 };

/**
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colors one hex color per name in DIAGRAM_ROLE_NAMES
 */
export function mermaidConfig(theme, colors) {
  const missing = DIAGRAM_ROLE_NAMES.filter((role) => !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(colors[role] ?? ""));
  if (missing.length > 0) throw new Error(`the ${theme} diagram colors lack a hex color for ${missing.join(", ")}`);
  /** @type {Record<string, string | boolean>} */
  const themeVariables = { darkMode: theme === "dark", fontFamily: FONT_FAMILY };
  for (const [variable, role] of Object.entries(DIAGRAM_ROLES)) themeVariables[variable] = /** @type {string} */ (colors[role]);
  return {
    // "base" is the only built-in theme whose variables are fully overridable; every other one hardcodes part of its palette.
    theme: "base",
    themeVariables,
    // Labels as real text, never `<foreignObject>`: a foreignObject is not rendered at all through `<img>`, so every node
    // would come out blank on the page while looking correct standalone.
    htmlLabels: false,
    flowchart: { htmlLabels: false, padding: 12, useMaxWidth: false },
    // Tightened from the defaults, for layout rather than taste: a wider drawing is scaled down and takes its type with
    // it, and narrowing the gaps shrinks the drawing without shrinking the text.
    sequence: {
      useMaxWidth: false,
      wrap: false,
      actorMargin: 24,
      width: 120,
      boxMargin: 8,
      noteMargin: 8,
      messageMargin: 28,
      // The mirrored row of actors at the foot repeats what the head already said and costs height a figure cannot spare.
      mirrorActors: false,
    },
  };
}

/**
 * Inside an `<img>` a percentage width means no intrinsic width, so the viewBox size is copied onto the root. A targeted
 * rewrite rather than re-serializing, because an `.svg` is parsed strictly.
 *
 * @param {string} svg
 * @param {string} label
 */
function sizeRoot(svg, label) {
  const openTag = svg.match(/<svg\b[^>]*>/)?.[0];
  if (!openTag) throw new Error(`${label}: no <svg> root tag`);
  const viewBox = openTag.match(/viewBox="([\d.\-\s]+)"/)?.[1];
  if (!viewBox) throw new Error(`${label}: root <svg> has no viewBox to size from`);
  const [, , width = 0, height = 0] = viewBox.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`${label}: viewBox "${viewBox}" has no usable size`);
  }
  const rewritten = openTag
    .replace(/\swidth="[^"]*"/, "")
    .replace(/\sheight="[^"]*"/, "")
    .replace(/max-width:\s*[^;"]+;?\s*/, "")
    .replace(/<svg\b/, `<svg width="${Math.ceil(width)}" height="${Math.ceil(height)}"`);
  return svg.replace(openTag, rewritten);
}

/**
 * Draws what is missing (or everything, with `force`), audits each drawing before writing it, and deletes nothing: it
 * returns the files no diagram names, for the caller to prune by its own rules. The browser is only launched when there
 * is something to draw, so a build with every asset current needs no Chromium. PUPPETEER_EXECUTABLE_PATH points
 * Puppeteer at an installed Chromium; MERMAID_PUPPETEER_CONFIG is JSON launch options, for example
 * {"args":["--no-sandbox"]} in a container that runs as root.
 *
 * @param {{
 *   diagrams: Array<{ key: string, source: string, label?: string }>,
 *   dir: string,
 *   assetPrefix: string,
 *   colors?: Record<"light" | "dark", Record<string, string>>,
 *   colours?: Record<"light" | "dark", Record<string, string>>, // codespell:ignore colours
 *   force?: boolean,
 *   log?: (line: string) => void,
 * }} options
 * @returns {Promise<{ written: string[], current: number, stale: string[], sizes: Record<string, { width: number, height: number }> }>}
 *   `sizes` is also written to DIAGRAM_SIZES_FILE in `dir`, for the site to pass to editorialPack's `diagramSizes`
 */
export async function drawDiagrams({ diagrams, dir, assetPrefix, colors: given, colours, force = false, log = console.log }) { // codespell:ignore colours
  // `colours`, the British spelling, is the option's old name, still taken so no site breaks. codespell:ignore colours
  const colors = /** @type {Record<"light" | "dark", Record<string, string>>} */ (given ?? colours); // codespell:ignore colours
  const themes = /** @type {Array<"light" | "dark">} */ (DIAGRAM_THEMES);
  const configs = { light: mermaidConfig("light", colors.light), dark: mermaidConfig("dark", colors.dark) };
  const fileName = (/** @type {string} */ key, /** @type {string} */ theme) => basename(diagramAssetPath(key, theme, assetPrefix));

  await mkdir(dir, { recursive: true });
  const outstanding = diagrams.flatMap((diagram) =>
    themes.filter((theme) => force || !existsSync(join(dir, fileName(diagram.key, theme)))).map((theme) => ({ diagram, theme })),
  );

  /** @type {string[]} */
  const written = [];
  const launchOptions = process.env.MERMAID_PUPPETEER_CONFIG ? JSON.parse(process.env.MERMAID_PUPPETEER_CONFIG) : {};
  const browser = outstanding.length > 0 ? await puppeteer.launch(launchOptions) : null;
  try {
    for (const { diagram, theme } of outstanding) {
      const name = fileName(diagram.key, theme);
      const label = `${name}${diagram.label ? ` (${diagram.label})` : ""}`;
      // The renderer's API rather than its command line: Node will not spawn the shim without a shell, and a shell joins
      // an argument array without quoting.
      const { data } = await renderMermaid(/** @type {import("puppeteer").Browser} */ (browser), diagram.source, "svg", {
        backgroundColor: "transparent",
        mermaidConfig: /** @type {any} */ (configs[theme]),
        svgId: SVG_ID,
        viewport: VIEWPORT,
      });
      const svg = sizeRoot(Buffer.from(data).toString("utf8"), label);
      // Audited before it is written, so a color Mermaid derived rather than took from the palette stops the build
      // instead of shipping.
      const audit = auditDiagramSvg(svg, Object.values(colors[theme]));
      if (audit.problems.length > 0) {
        throw new Error(`${label} uses colors that are not the site's:\n${audit.problems.map((p) => `    ${p}`).join("\n")}`);
      }
      await writeFile(join(dir, name), svg, "utf8");
      written.push(name);
      log(`  wrote ${name} (${Math.round(svg.length / 1024)} kB, ${audit.checked} colors checked)`);
    }
  } finally {
    await browser?.close();
  }

  const live = [...new Set(diagrams.flatMap((d) => themes.map((t) => fileName(d.key, t))))].sort();
  const stale = (await readdir(dir)).filter((name) => name.endsWith(".svg") && !live.includes(name));
  // Every drawing's size, read back from the root sizeRoot wrote, so the renderer sizes its <img> (DIAGRAM_SIZES_FILE).
  /** @type {Record<string, { width: number, height: number }>} */
  const sizes = {};
  for (const name of live) {
    const root = (await readFile(join(dir, name), "utf8")).match(/<svg\b[^>]*>/)?.[0] ?? "";
    const width = Number(/\swidth="(\d+)"/.exec(root)?.[1]);
    const height = Number(/\sheight="(\d+)"/.exec(root)?.[1]);
    if (width > 0 && height > 0) sizes[name] = { width, height };
  }
  await writeFile(join(dir, DIAGRAM_SIZES_FILE), `${JSON.stringify(sizes, null, 2)}\n`, "utf8");
  return { written, current: diagrams.length * themes.length - outstanding.length, stale, sizes };
}

/**
 * Deletes the named files from `dir`.
 *
 * @param {string} dir
 * @param {string[]} names
 */
export async function pruneDiagrams(dir, names) {
  for (const name of names) await unlink(join(dir, name));
}

const COLOR_PROPERTIES = new Set([
  "fill",
  "stroke",
  "color",
  "background",
  "background-color",
  "stop-color",
  "flood-color",
  "border",
  "border-color",
  "outline",
  "outline-color",
]);

// `currentColor` is safe because it resolves to `color`, which is itself audited.
const NON_COLOR_VALUES = new Set(["none", "transparent", "currentcolor", "inherit", "initial", "unset", "revert"]);

/** @param {string} hex */
function normalizeHex(hex) {
  const h = hex.toLowerCase();
  return h.length === 4 ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}` : h;
}

/**
 * By brace depth, not splitting on `}`: Mermaid's stylesheet opens with nested at-rules. Unbalanced braces throw: a stray
 * `}` drove the depth negative and every later rule was silently lost.
 *
 * @param {string} text
 * @returns {Array<{ selector: string, body: string }>}
 */
function cssRules(text) {
  /** @type {Array<{ selector: string, body: string }>} */
  const out = [];
  let depth = 0;
  let start = 0;
  let selectorEnd = -1;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "{") {
      if (depth === 0) selectorEnd = i;
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth < 0) throw new Error(`unbalanced stylesheet: a "}" at offset ${i} closes nothing`);
      if (depth === 0) {
        out.push({ selector: text.slice(start, selectorEnd).trim(), body: text.slice(selectorEnd + 1, i) });
        start = i + 1;
      }
    }
  }
  if (depth !== 0) throw new Error(`unbalanced stylesheet: ${depth} "{" never closed`);
  return out;
}

/** At-rules whose body is more rules, applied when a condition holds, so their rules are audited. */
const GROUPING_AT_RULES = /^@(media|supports|layer|container|document|scope)\b/i;

/** @param {string} body */
function colorDeclarations(body) {
  /** @type {Array<{ property: string, value: string }>} */
  const out = [];
  for (const m of body.matchAll(/([a-zA-Z-]+)\s*:\s*([^;{}]+)/g)) {
    const property = (m[1] ?? "").toLowerCase();
    if (COLOR_PROPERTIES.has(property)) out.push({ property, value: (m[2] ?? "").trim() });
  }
  return out;
}

/**
 * Allowlist, not a hex hunt, so rgb(), hsl() and named colors are caught too.
 *
 * @param {string} value
 * @param {Set<string>} palette
 */
function colorProblem(value, palette) {
  const cleaned = value.replace(/!important/gi, "").trim();
  const lower = cleaned.toLowerCase();
  if (cleaned === "" || NON_COLOR_VALUES.has(lower) || lower.startsWith("url(")) return null;
  if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(cleaned)) {
    return palette.has(normalizeHex(cleaned)) ? null : `${cleaned} is not one of the palette's colors`;
  }
  return `${cleaned} is not a palette color`;
}

/**
 * Every color a drawing can paint must be one of the palette's: in its `<style>` (rules inside conditional group rules
 * included, `@keyframes` audited whole, a rule no element matches skipped and counted), in `style` attributes, and in
 * presentation attributes no stylesheet rule overrides, on every element except unreferenced `<defs>` children.
 *
 * @param {string} svg
 * @param {string[]} paletteHexes
 * @returns {{ checked: number, skippedRules: number, overridden: number, problems: string[] }}
 */
export function auditDiagramSvg(svg, paletteHexes) {
  const palette = new Set(paletteHexes.map(normalizeHex));
  const { document } = parseHTML(`<!DOCTYPE html><html><body>${svg}</body></html>`);
  const root = document.querySelector("svg");
  if (!root) return { checked: 0, skippedRules: 0, overridden: 0, problems: ["no <svg> element"] };

  /** @type {string[]} */
  const problems = [];
  let checked = 0;
  let skippedRules = 0;
  let overridden = 0;
  /** @type {Array<{ selectors: string[], properties: Set<string> }>} */
  const styling = [];

  /**
   * @param {string} where
   * @param {Array<{ property: string, value: string }>} declarations
   */
  const check = (where, declarations) => {
    for (const { property, value } of declarations) {
      checked += 1;
      const problem = colorProblem(value, palette);
      if (problem) problems.push(`${where} ${property}: ${problem}`);
    }
  };

  /** @param {string} text */
  const auditRules = (text) => {
    for (const rule of cssRules(text)) {
      if (GROUPING_AT_RULES.test(rule.selector)) {
        auditRules(rule.body);
        continue;
      }
      const declarations = colorDeclarations(rule.body);
      if (declarations.length === 0) continue;
      if (rule.selector.startsWith("@")) {
        check(rule.selector, declarations);
        continue;
      }
      const selectors = rule.selector.split(",").map((s) => s.trim()).filter(Boolean);
      styling.push({ selectors, properties: new Set(declarations.map((d) => d.property)) });
      const reachable = selectors.some((one) => {
        try {
          return Boolean(document.querySelector(one));
        } catch {
          // Unparseable selectors count as reachable, so the rule is audited rather than skipped.
          return true;
        }
      });
      if (reachable) check(rule.selector, declarations);
      else skippedRules += 1;
    }
  };
  for (const style of document.querySelectorAll("style")) auditRules(style.textContent ?? "");

  // Unreferenced <defs> children, and everything under them, are never painted. A reference is url(#id) (markers,
  // gradients) or an href to #id (<use>), and both keep the target audited.
  const serialized = root.toString();
  const all = [root, ...root.querySelectorAll("*")];
  const hrefs = new Set(
    all.flatMap((el) => ["href", "xlink:href"].map((n) => el.getAttribute(n) ?? "")).filter((v) => v.startsWith("#")).map((v) => v.slice(1)),
  );
  const dead = new Set();
  for (const defs of document.querySelectorAll("defs")) {
    for (const child of defs.children) {
      const id = child.getAttribute("id");
      if (!id || (!serialized.includes(`url(#${id})`) && !hrefs.has(id))) {
        for (const el of [child, ...child.querySelectorAll("*")]) dead.add(el);
      }
    }
  }

  /**
   * A presentation attribute a stylesheet rule overrides is never painted.
   *
   * @param {any} element
   * @param {string} property
   */
  const styledBy = (element, property) =>
    styling.some(
      (rule) =>
        rule.properties.has(property) &&
        rule.selectors.some((selector) => {
          try {
            return element.matches(selector);
          } catch {
            return false;
          }
        }),
    );

  // The root carries attributes too: Mermaid writes its background into `style`.
  for (const element of all) {
    if (dead.has(element)) continue;
    for (const attribute of element.attributes) {
      const name = attribute.name.toLowerCase();
      if (name === "style") check(`<${element.localName} style>`, colorDeclarations(attribute.value));
      else if (!COLOR_PROPERTIES.has(name)) continue;
      else if (styledBy(element, name)) overridden += 1;
      else check(`<${element.localName}>`, [{ property: name, value: attribute.value }]);
    }
  }

  return { checked, skippedRules, overridden, problems };
}
