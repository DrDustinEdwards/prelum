import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
// The files the specimen build writes besides its pages: the stylesheets, the diagrams and the bundled scripts.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { bundleScript, capsomerStylesheet, copyFonts } from "capsomer/build";
import { capsomerTheme } from "capsomer/enarratio-theme";
import { stylesheet } from "enarratio";

import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES, diagramAssetPath } from "../render-diagram.mjs";
import { ASSET_PREFIX, DIAGRAM_CONFIG_FILE, FAMILY, diagramConfig } from "./specimen.mjs";

/** @param {string} specifier a package file, resolved from this repository's node_modules */
const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @param {string} specifier a package file, resolved from this repository's node_modules */
const packageFile = (specifier) => require.resolve(specifier);

/** @param {string} outDir */
export function writeStyles(outDir) {
  // Capsomer's fonts, tokens, the specimen's family, base, the link system and prose, then the NASA manual theme every
  // dustinedwards.info public page shares, the theme button and its tip, the letterhead, the family footer and the
  // frame every :::chart sits in (capsomer/build), then Enarratio's chart styles in Capsomer's theme, site.css and output.css.
  copyFonts(join(outDir, "fonts"));
  const css = capsomerStylesheet({
    family: FAMILY,
    prose: true,
    parts: ["manual", "popover", "theme-switch", "site-header", "family-footer", "chart-frame"],
    // Capsomer's tokens.css also maps the --enarratio-* properties onto its tokens (css/enarratio.css). The two agree, being
    // generated from the same tokens; Enarratio has no color-free base stylesheet, so its full one is used.
    after: [
      stylesheet(capsomerTheme),
      ...["site.css", "output.css"].map((file) => readFileSync(join(HERE, file), "utf8")),
    ],
  });
  writeFileSync(
    join(outDir, "site.css"),
    `/* Built by specimen/build.mjs with capsomer/build, then specimen/site.css and output.css. */\n${css}`,
  );

  // KaTeX's stylesheet names its fonts relative to itself. Only the woff2 files are copied: every browser that reads the
  // stylesheet's first src takes them. KaTeX ships font-display: block, which hides the math for up to three seconds;
  // swap shows it in the fallback face at once.
  const katex = dirname(packageFile("katex/dist/katex.min.css"));
  mkdirSync(join(outDir, "katex", "fonts"), { recursive: true });
  const katexCss = readFileSync(join(katex, "katex.min.css"), "utf8").replaceAll(
    "font-display:block",
    "font-display:swap",
  );
  writeFileSync(join(outDir, "katex", "katex.min.css"), katexCss);
  for (const font of readdirSync(join(katex, "fonts")).filter((f) => f.endsWith(".woff2"))) {
    copyFileSync(join(katex, "fonts", font), join(outDir, "katex", "fonts", font));
  }
}

/**
 * Diagrams are drawn ahead of time (specimen/diagrams.mjs) because layout needs a browser; the build only copies them, and
 * stops when one is missing rather than publish a broken image.
 *
 * @param {string} outDir
 * @param {Array<{ key: string }>} diagrams
 */
export function copyDiagrams(outDir, diagrams) {
  const stamp = join(HERE, DIAGRAM_ASSET_DIR, DIAGRAM_CONFIG_FILE);
  if (
    diagrams.length > 0 &&
    (!existsSync(stamp) ||
      readFileSync(stamp, "utf8") !== `${JSON.stringify(diagramConfig(), null, 2)}\n`)
  ) {
    throw new Error(
      `specimen diagrams were drawn with another palette or Mermaid version than ${DIAGRAM_ASSET_DIR}/${DIAGRAM_CONFIG_FILE} now ` +
        "calls for. Run npm run specimen:diagrams and commit them.",
    );
  }
  const missing = [];
  for (const { key } of diagrams) {
    for (const theme of DIAGRAM_THEMES) {
      const path = diagramAssetPath(key, theme, ASSET_PREFIX);
      const source = join(HERE, path);
      if (!existsSync(source)) {
        missing.push(path);
        continue;
      }
      mkdirSync(dirname(join(outDir, path)), { recursive: true });
      copyFileSync(source, join(outDir, path));
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `specimen diagrams not drawn: ${missing.join(", ")}. Run npm run specimen:diagrams and commit them.`,
    );
  }
}

/**
 * Bundles a script of specimen/browser for the browser, Capsomer's behavior and every lazy import inlined (Enarratio's
 * sound, loaded on Play), so each script stays one file under the page's script hashes.
 *
 * @param {string} file
 * @param {"esm" | "iife"} format
 */
export async function bundle(file, format) {
  const code = await bundleScript(join(HERE, "browser", file), { format });
  // An import the bundler could not resolve is left as a bare specifier, which a browser cannot load: the whole script
  // throws and the theme button dies. Capsomer imports this package by name, so it must be installed (the devDependency
  // "file:." links it to itself).
  const bare = /(?:\bfrom|\bimport)\s*\(?\s*["']([^./"'][^"']*)["']/.exec(code);
  if (bare)
    throw new Error(
      `specimen/browser/${file} bundles to a bare import of "${bare[1]}"; the browser cannot resolve it`,
    );
  return code;
}
