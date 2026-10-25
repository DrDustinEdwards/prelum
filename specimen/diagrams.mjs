// Draws the specimen's diagrams, one SVG per theme, into specimen/diagrams, colored from Capsomer's tokens, with the same
// drawing code every site uses (render-diagram-draw.mjs). It is run by hand when a diagram source changes and the drawings
// are committed, so the site build needs no browser. Missing drawings are drawn, every drawing is drawn again when the
// configuration in config.json changes, and drawings no element uses are deleted.
//
//   npm run specimen:diagrams
//
// Where Chromium is already installed, point PUPPETEER_EXECUTABLE_PATH at it; MERMAID_PUPPETEER_CONFIG is JSON launch
// options, for example {"args":["--no-sandbox"]} in a container that runs as root.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { drawDiagrams, pruneDiagrams } from "../render-diagram-draw.mjs";
import { DIAGRAM_ASSET_DIR } from "../render-diagram.mjs";
import { ASSET_PREFIX, DIAGRAM_CONFIG_FILE, diagramConfig, loadElements, renderElement } from "./specimen.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), DIAGRAM_ASSET_DIR);

const diagrams = [];
for (const element of loadElements()) diagrams.push(...(await renderElement(element)).diagrams);

const config = diagramConfig();
const stamp = join(OUT, DIAGRAM_CONFIG_FILE);
// Drawings made with another palette or Mermaid version are all drawn again: the file names hash only the source.
const force = !existsSync(stamp) || readFileSync(stamp, "utf8") !== `${JSON.stringify(config, null, 2)}\n`;
const { written, stale } = await drawDiagrams({ diagrams, dir: OUT, assetPrefix: ASSET_PREFIX, colors: config, force });
await pruneDiagrams(OUT, stale);
writeFileSync(stamp, `${JSON.stringify(config, null, 2)}\n`);
console.log(`specimen diagrams: ${diagrams.length} diagram(s), ${written.length} drawn, ${stale.length} stale removed`);
