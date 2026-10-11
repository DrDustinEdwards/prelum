// Draws the specimen's diagrams, one SVG per theme, into specimen/diagrams, coloured from Capsomer's tokens. Layout needs real font
// metrics, so this runs Mermaid's own command line in a browser; it is run by hand when a diagram source changes and the drawings
// are committed, so the site build needs no browser (as dustinedwards-info's scripts/build-diagrams.mjs does). Only missing drawings
// are drawn, and drawings no element uses are deleted.
//
//   npm run specimen:diagrams
//
// Mermaid's command line drives Chromium through Puppeteer. Where Chromium is already installed, point PUPPETEER_EXECUTABLE_PATH
// at it (and set PUPPETEER_SKIP_DOWNLOAD=1 so npx does not fetch another). MERMAID_PUPPETEER_CONFIG names a Puppeteer launch
// config for mmdc's -p, for example {"args":["--no-sandbox"]} in a container that runs as root.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES, diagramAssetPath } from "../render-diagram.mjs";
import { ASSET_PREFIX, loadElements, renderElement } from "./specimen.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, DIAGRAM_ASSET_DIR);
const MERMAID_CLI = "@mermaid-js/mermaid-cli@11.16.0";

/**
 * The colour tokens of one theme, read from Capsomer's generated colour.css: the light theme is the first :root block, the dark
 * one the [data-theme="dark"] block.
 *
 * @param {"light" | "dark"} theme
 */
function capsomerColours(theme) {
  const css = readFileSync(join(dirname(createRequire(import.meta.url).resolve("capsomer/tokens.css")), "..", "tokens", "colour.css"), "utf8");
  const start = theme === "light" ? css.indexOf(":root {") : css.indexOf(':root[data-theme="dark"] {');
  const block = css.slice(start, css.indexOf("}", start));
  /** @type {Record<string, string>} */
  const tokens = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) tokens[name ?? ""] = value ?? "";
  for (const name of ["surface", "raised", "text", "muted", "accent-soft", "accent-line", "line-strong"]) {
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

const puppeteer = process.env.MERMAID_PUPPETEER_CONFIG ? ["-p", process.env.MERMAID_PUPPETEER_CONFIG] : [];

const diagrams = [];
for (const element of loadElements()) diagrams.push(...(await renderElement(element)).diagrams);

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "prelum-diagrams-"));
let drawn = 0;
try {
  for (const { key, source } of diagrams) {
    for (const theme of /** @type {Array<"light" | "dark">} */ (DIAGRAM_THEMES)) {
      const file = join(OUT, basename(diagramAssetPath(key, theme, ASSET_PREFIX)));
      if (existsSync(file)) continue;
      const input = join(work, `${key}.mmd`);
      const config = join(work, `${theme}.json`);
      writeFileSync(input, source);
      writeFileSync(config, JSON.stringify(mermaidConfig(theme)));
      execFileSync("npx", ["--yes", "-p", MERMAID_CLI, "mmdc", "-i", input, "-o", file, "-c", config, "-b", "transparent", "-I", "diagram", ...puppeteer], {
        stdio: "inherit",
      });
      drawn += 1;
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const live = new Set(diagrams.flatMap(({ key }) => DIAGRAM_THEMES.map((t) => basename(diagramAssetPath(key, t, ASSET_PREFIX)))));
const stale = readdirSync(OUT).filter((name) => name.endsWith(".svg") && !live.has(name));
for (const name of stale) rmSync(join(OUT, name));
console.log(`specimen diagrams: ${diagrams.length} diagram(s), ${drawn} drawn, ${stale.length} stale removed`);
