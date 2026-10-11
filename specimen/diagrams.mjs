// Draws the specimen's diagrams, one SVG per theme, into specimen/diagrams, coloured from Capsomer's tokens. Layout needs real font
// metrics, so this runs Mermaid's own command line in a browser; it is run by hand when a diagram source changes and the drawings
// are committed, so the site build needs no browser (as dustinedwards-info's scripts/build-diagrams.mjs does). Missing drawings are
// drawn, every drawing is drawn again when the configuration in config.json changes, and drawings no element uses are deleted.
//
//   npm run specimen:diagrams
//
// Mermaid's command line drives Chromium through Puppeteer. Where Chromium is already installed, point PUPPETEER_EXECUTABLE_PATH
// at it (and set PUPPETEER_SKIP_DOWNLOAD=1 so npx does not fetch another). MERMAID_PUPPETEER_CONFIG names a Puppeteer launch
// config for mmdc's -p, for example {"args":["--no-sandbox"]} in a container that runs as root.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES, diagramAssetPath } from "../render-diagram.mjs";
import { ASSET_PREFIX, DIAGRAM_CONFIG_FILE, diagramConfig, loadElements, renderElement } from "./specimen.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, DIAGRAM_ASSET_DIR);
const puppeteer = process.env.MERMAID_PUPPETEER_CONFIG ? ["-p", process.env.MERMAID_PUPPETEER_CONFIG] : [];

const diagrams = [];
for (const element of loadElements()) diagrams.push(...(await renderElement(element)).diagrams);

mkdirSync(OUT, { recursive: true });
const config = diagramConfig();
const stamp = join(OUT, DIAGRAM_CONFIG_FILE);
// Drawings made with another palette or Mermaid version are all drawn again: the file names hash only the source.
const redraw = !existsSync(stamp) || readFileSync(stamp, "utf8") !== `${JSON.stringify(config, null, 2)}\n`;
const work = mkdtempSync(join(tmpdir(), "prelum-diagrams-"));
let drawn = 0;
try {
  for (const { key, source } of diagrams) {
    for (const theme of /** @type {Array<"light" | "dark">} */ (DIAGRAM_THEMES)) {
      const file = join(OUT, basename(diagramAssetPath(key, theme, ASSET_PREFIX)));
      if (existsSync(file) && !redraw) continue;
      const input = join(work, `${key}.mmd`);
      writeFileSync(input, source);
      const themeConfig = join(work, `${theme}.json`);
      writeFileSync(themeConfig, JSON.stringify(config[theme]));
      execFileSync("npx", ["--yes", "-p", config.mermaidCli, "mmdc", "-i", input, "-o", file, "-c", themeConfig, "-b", "transparent", "-I", "diagram", ...puppeteer], {
        stdio: "inherit",
      });
      drawn += 1;
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(stamp, `${JSON.stringify(config, null, 2)}\n`);

const live = new Set(diagrams.flatMap(({ key }) => DIAGRAM_THEMES.map((t) => basename(diagramAssetPath(key, t, ASSET_PREFIX)))));
const stale = readdirSync(OUT).filter((name) => name.endsWith(".svg") && !live.has(name));
for (const name of stale) rmSync(join(OUT, name));
console.log(`specimen diagrams: ${diagrams.length} diagram(s), ${drawn} drawn, ${stale.length} stale removed`);
