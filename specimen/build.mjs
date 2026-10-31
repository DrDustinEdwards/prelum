// Builds the specimen site at https://prelum.dustinedwards.info into specimen/dist (or the directory named): one page showing every
// element in specimen/elements as its markdown beside Prelum's output, what a short post becomes in an RSS item and in llms.txt, and
// elements.json, the index Carrel's Insert menu reads. Static files only; the one script is Capsomer's letterhead and theme button,
// served from the site's own origin (no inline script).
//
//   node specimen/build.mjs [outDir]

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { securityTxt } from "@dustinedwards/site-runtime/security-txt";
import { familyFooterHtml } from "capsomer/behavior/family-footer";
import { letterheadHtml } from "capsomer/behavior/site-header";
import { capsomerTheme } from "capsomer/enarratio-theme";
import { stylesheet } from "enarratio";
import { rolldown } from "rolldown";

import { llmsDocument } from "../llms.mjs";
import { rssItem } from "../feeds.mjs";
import { sitemapDocument } from "../sitemap.mjs";
import { RENDER_VERSION, render } from "../render.mjs";
import { iconLinks, webManifest } from "../icons.mjs";
import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES, diagramAssetPath } from "../render-diagram.mjs";
import { absolutizeUrls, escapeXml, mathToTex } from "../xml.mjs";
import { HEADERS_FILE } from "./headers.mjs";
import { ASSET_PREFIX, DIAGRAM_CONFIG_FILE, FAMILY, ORIGIN, diagramConfig, elementIndex, loadElements, options, renderElement, resolveImage, splitHeader } from "./specimen.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(import.meta.url);
const REPO = "https://github.com/DrDustinEdwards/prelum";

/** The IndexNow key, served as /<key>.txt; .github/workflows/specimen.yml reads it here to ping IndexNow. Public by design. */
const INDEXNOW_KEY = "32790edc1bac129b5f5c0b174219150c";

/** When security.txt lapses (RFC 9116 asks for under a year); renew it before then. */
const SECURITY_TXT_EXPIRES = "2027-10-26T00:00:00Z";

/** @param {string} specifier a package file, resolved from this repository's node_modules */
const packageFile = (specifier) => require.resolve(specifier);

/**
 * Capsomer's stylesheets import their parts; the specimen serves one file, so each import is read in place, wrapped in its
 * layer when it names one.
 *
 * @param {string} file
 * @param {Set<string>} [seen]
 * @returns {string}
 */
function inlineCss(file, seen = new Set()) {
  if (seen.has(file)) return "";
  seen.add(file);
  return readFileSync(file, "utf8").replace(
    /@import\s+"([^"]+)"(?:\s+layer\(([\w.-]+)\))?\s*;/g,
    (_, path, layer) => {
      const inner = inlineCss(join(dirname(file), path), seen);
      return layer ? `@layer ${layer} {\n${inner}\n}` : inner;
    },
  );
}

/** Source Serif 4, the prose face, latin only: the specimen is in English. Capsomer's fonts.css has the family's other faces. */
const SERIF = ["normal", "italic"].map((style) => ({
  file: `@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-${style}.woff2`,
  style,
}));

/** @param {string} outDir */
function writeStyles(outDir) {
  // Capsomer's fonts.css names its files as ../fonts/ from css/; site.css sits beside fonts/.
  copyTree(join(dirname(packageFile("capsomer/fonts.css")), "..", "fonts"), join(outDir, "fonts"));
  const faces = SERIF.map((font) => {
    const name = font.file.split("/").pop() ?? "";
    copyFileSync(packageFile(font.file), join(outDir, "fonts", name));
    return `@font-face {\n  font-family: "Source Serif 4";\n  font-style: ${font.style};\n  font-weight: 200 900;\n  font-display: swap;\n  src: url("fonts/${name}") format("woff2");\n}`;
  });
  const capsomer = dirname(packageFile("capsomer/tokens.css"));
  const css = [
    "/* Built by specimen/build.mjs: Capsomer's fonts, tokens, the specimen's family, base, prose and manual styles, Enarratio's chart styles in Capsomer's theme, and specimen/site.css. */",
    inlineCss(packageFile("capsomer/fonts.css")).replaceAll("../fonts/", "fonts/"),
    ...faces,
    inlineCss(join(capsomer, "tokens.css")),
    inlineCss(join(capsomer, "base.css")),
    inlineCss(join(capsomer, "prose.css")),
    // The NASA manual theme every dustinedwards.info public page shares, in the specimen's own family.
    `@layer cap.tokens {\n${inlineCss(join(capsomer, "..", "tokens", `family-${FAMILY}.css`))}\n}`,
    inlineCss(join(capsomer, "..", "components", "manual", "manual.css")),
    // The theme button in the letterhead, and the tooltip (a popover) that names it.
    inlineCss(join(capsomer, "..", "components", "popover", "popover.css")),
    inlineCss(join(capsomer, "..", "components", "theme-switch", "theme-switch.css")),
    // The family letterhead at the top of every page, pinned while it scrolls.
    inlineCss(join(capsomer, "..", "components", "site-header", "site-header.css")),
    // The family footer every dustinedwards.info site ends with, and the color marks of its Network strip.
    inlineCss(join(capsomer, "..", "tokens", "family-marks.css")),
    inlineCss(join(capsomer, "..", "components", "family-footer", "family-footer.css")),
    // Capsomer's tokens.css also maps the --enarratio-* properties onto its tokens (css/enarratio.css). The two agree, being
    // generated from the same tokens; Enarratio 0.1.0-alpha.8 has no color-free base stylesheet, so its full one is used.
    stylesheet(capsomerTheme),
    readFileSync(join(HERE, "site.css"), "utf8"),
  ].join("\n\n");
  writeFileSync(join(outDir, "site.css"), css);

  // KaTeX's stylesheet names its fonts relative to itself. Only the woff2 files are copied: every browser that reads the
  // stylesheet's first src takes them.
  const katex = dirname(packageFile("katex/dist/katex.min.css"));
  mkdirSync(join(outDir, "katex", "fonts"), { recursive: true });
  copyFileSync(join(katex, "katex.min.css"), join(outDir, "katex", "katex.min.css"));
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
function copyDiagrams(outDir, diagrams) {
  const stamp = join(HERE, DIAGRAM_ASSET_DIR, DIAGRAM_CONFIG_FILE);
  if (diagrams.length > 0 && (!existsSync(stamp) || readFileSync(stamp, "utf8") !== `${JSON.stringify(diagramConfig(), null, 2)}\n`)) {
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
    throw new Error(`specimen diagrams not drawn: ${missing.join(", ")}. Run npm run specimen:diagrams and commit them.`);
  }
}

/**
 * Bundles a script of specimen/browser for the browser, Capsomer's behavior inlined.
 *
 * @param {string} file
 * @param {"esm" | "iife"} format
 */
async function bundle(file, format) {
  const built = await rolldown({ input: join(HERE, "browser", file), platform: "browser", logLevel: "silent" });
  const { output } = await built.generate({ format, minify: true });
  await built.close();
  const [chunk] = output;
  if (output.length !== 1 || chunk?.type !== "chunk") throw new Error(`${file}: expected one chunk`);
  return chunk.code;
}

/** @param {string} from @param {string} to */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(join(from, entry.name), join(to, entry.name));
    else copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}

/**
 * The family footer (capsomer/family-footer), with Prelum's own part under its thin cerulean stripe.
 * @param {string} version
 */
const footerHtml = (version) =>
  familyFooterHtml({
    site: "prelum",
    center: `<div class="cap-family-footer-center">
<div><p class="cap-family-footer-center-name">Prelum</p><p class="cap-family-footer-about">The family's publishing library: markdown to pages, feeds, sitemaps, llms.txt and search.</p></div>
<div class="cap-family-footer-columns">
<ul class="cap-family-footer-links"><li><a href="/#contents-name">Every element</a></li><li><a href="/elements.json">elements.json</a></li></ul>
<ul class="cap-family-footer-links"><li><a href="${REPO}">Source, MIT licensed</a></li><li><a href="${REPO}#readme">How to use it</a></li></ul>
</div>
<p class="cap-family-footer-stamp"><span>Release ${escapeXml(version)}</span><span>Render version ${escapeXml(RENDER_VERSION)}</span><span>Styled with Capsomer, charts drawn by Enarratio</span></p>
</div>`,
  });

/** The family letterhead (capsomer/site-header), with its theme button, wired by /specimen.js. */
const HEADER = letterheadHtml({
  name: "Prelum",
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M10 7h8a6 6 0 0 1 0 12h-4v6h-4z"/></svg>',
  links: [
    ["/", "Home"],
    ["/#contents-name", "Elements"],
    ["/#outputs", "Outputs"],
  ],
  current: "Home",
});

const ICON_LINKS = iconLinks()
  .map((link) => `<link ${Object.entries(link).map(([name, value]) => `${name}="${value}"`).join(" ")}>`)
  .join("\n");

/**
 * @param {{ title: string, description: string, body: string, version: string }} page
 */
function documentHtml({ title, description, body, version }) {
  return `<!doctype html>
<html lang="en" data-family="${FAMILY}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<meta name="description" content="${escapeXml(description)}">
${ICON_LINKS}
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/katex/katex.min.css">
<script src="/theme.js"></script>
</head>
<body>
${HEADER}
<div class="cap-page">
${body}
</div>
<footer><div class="cap-page">${footerHtml(version)}</div></footer>
<script type="module" src="/specimen.js"></script>
</body>
</html>
`;
}

/** @param {string} label @param {string} text */
const codeView = (label, text) =>
  `<details><summary>${escapeXml(label)}</summary><pre class="code-view" tabindex="0"><code>${escapeXml(text)}</code></pre></details>`;

/** What a feed carries for this HTML: rssItem's own transformation, TeX for math and absolute URLs. */
const feedForm = (/** @type {string} */ html) => absolutizeUrls(mathToTex(html), ORIGIN);

/**
 * @param {import("./specimen.mjs").Element} element
 * @param {string} html
 * @param {number} no its number on the page
 */
function elementSection(element, html, no) {
  const directives = element.directives.map((d) => `:${d}`).join(", ");
  const pack =
    element.pack === "editorial"
      ? `<span class="element-pack">editorial pack</span>`
      : `<span class="element-pack">core</span>`;
  const feed = feedForm(html);
  return `<section class="element" id="el-${element.id}" aria-labelledby="el-${element.id}-name">
<h2 class="element-name cap-part-title" id="el-${element.id}-name"><span class="cap-part-no">${no}</span><a href="#el-${element.id}">${escapeXml(element.name)}</a></h2>
<p class="element-meta">${escapeXml(element.summary)} ${pack}${directives ? ` <span class="sr-only">directives:</span> <code>${escapeXml(directives)}</code>` : ""}</p>
<div class="pair">
<div>
<p class="pair-label">Markdown</p>
<pre class="source" tabindex="0"><code>${escapeXml(element.source.trimEnd())}</code></pre>
</div>
<div>
<p class="pair-label">Output</p>
<div class="output prose" data-context="prose">
${html}
</div>
</div>
</div>
<div class="views">
${codeView("The HTML", html)}
${feed === html ? "" : codeView("In the RSS item", feed)}
</div>
</section>`;
}

/**
 * A short post through every output Prelum makes from it: the page's HTML, the RSS item and the llms.txt entry.
 *
 * @param {string} version
 * @param {number} no its number on the page
 */
async function outputsSection(version, no) {
  const text = readFileSync(join(HERE, "sample-post.md"), "utf8");
  const { header: meta, source: body } = splitHeader("specimen/sample-post.md", text, ["title", "slug", "description", "date"]);
  const { html } = await render({ file: "specimen/sample-post.md", body, resolveImage, options });
  const post = {
    slug: meta.slug ?? "",
    title: meta.title ?? "",
    html,
    description: meta.description ?? null,
    publishAt: meta.date ?? null,
    tags: [],
  };
  const item = rssItem(post, ORIGIN);
  // The address the feed gives the post, so the llms.txt line and the RSS item cannot disagree.
  const link = /<link>([^<]+)<\/link>/.exec(item)?.[1];
  if (!link) throw new Error("the sample post's RSS item has no <link>");
  const llms = llmsDocument({
    title: "Prelum specimen",
    summary: `Every element Prelum ${version} renders from markdown.`,
    sections: [{ heading: "Writing", links: [{ title: post.title, url: link, description: meta.description }] }],
  });
  return `<section class="outputs" id="outputs" aria-labelledby="outputs-name">
<h2 class="element-name cap-part-title" id="outputs-name"><span class="cap-part-no">${no}</span><a href="#outputs">One source, three outputs</a></h2>
<p class="element-meta">A short post as a site publishes it: the page, the RSS item (<code>rssItem</code>: math as TeX, URLs made absolute) and the line llms.txt gives it (<code>llmsDocument</code>).</p>
<div class="pair">
<div>
<p class="pair-label">Markdown</p>
<pre class="source" tabindex="0"><code>${escapeXml(text.trimEnd())}</code></pre>
</div>
<div>
<p class="pair-label">Page</p>
<div class="output prose" data-context="prose">
${html}
</div>
</div>
</div>
<p class="pair-label">RSS item</p>
<pre class="code-view" tabindex="0"><code>${escapeXml(item)}</code></pre>
<p class="pair-label">llms.txt</p>
<pre class="code-view" tabindex="0"><code>${escapeXml(llms.trimEnd())}</code></pre>
</section>`;
}

/**
 * An id used twice on one page breaks its anchors and its accessible names. The elements are rendered separately, so two of
 * them could each produce the same heading id.
 *
 * @param {string} html
 */
function assertUniqueIds(html) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const [, id] of html.matchAll(/\sid="([^"]+)"/g)) counts.set(/** @type {string} */ (id), (counts.get(/** @type {string} */ (id)) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  if (repeated.length > 0) throw new Error(`the specimen page repeats the id ${repeated.join(", ")}`);
}

/**
 * @param {string} outDir
 * @returns {Promise<{ version: string, elements: number, files: string[] }>}
 */
export async function buildSpecimen(outDir) {
  const version = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
  const elements = loadElements();
  /** @type {Awaited<ReturnType<typeof renderElement>>[]} */
  const rendered = [];
  for (const element of elements) rendered.push(await renderElement(element));

  // Only an earlier build is deleted: a mistyped outDir must not take the working tree with it.
  if (existsSync(outDir) && readdirSync(outDir).length > 0 && !existsSync(join(outDir, "elements.json"))) {
    throw new Error(`${outDir} is not empty and holds no earlier specimen build; refusing to delete it`);
  }
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(join(HERE, "static"), outDir);
  writeFileSync(join(outDir, "_headers"), HEADERS_FILE);
  writeFileSync(join(outDir, "site.webmanifest"), JSON.stringify(webManifest({ name: "Prelum specimen", shortName: "Prelum", themeColor: "#4f2d7f", backgroundColor: "#4f2d7f" })));
  writeStyles(outDir);
  // The remembered theme before first paint (a plain script in the head), and the letterhead's behavior.
  writeFileSync(join(outDir, "theme.js"), await bundle("theme.mjs", "iife"));
  writeFileSync(join(outDir, "specimen.js"), await bundle("specimen.mjs", "esm"));
  copyDiagrams(outDir, rendered.flatMap((r) => r.diagrams));

  /** @param {number} no @param {string} href @param {string} name @param {string} fact */
  const indexRow = (no, href, name, fact) =>
    `<li><a class="cap-leader-index-link" href="${href}"><span class="cap-leader-index-no">${no}</span><span class="cap-leader-index-name">${escapeXml(name)}</span><span class="cap-leader-index-dots" aria-hidden="true"></span><span class="cap-leader-index-fact">${fact}</span></a></li>`;
  const contents = elements.map((e, i) => indexRow(i + 1, `#el-${e.id}`, e.name, e.pack)).join("\n");
  const editorialCount = elements.filter((e) => e.pack === "editorial").length;
  const body = `<main id="main" tabindex="-1">
<header class="page-head">
<h1>Prelum specimen</h1>
<p class="page-lead">Every element Prelum renders from markdown, each source beside its output, in the configuration dustinedwards.info uses: the core, the editorial pack and code highlighting. The page follows your system's light or dark setting until you choose one with the button in the letterhead. The list is also at <a href="/elements.json">elements.json</a>, generated from the same sources.</p>
<dl class="cap-form-boxes" data-variant="readings">
<div class="cap-form-boxes-box"><dt>Release</dt><dd>${escapeXml(version)}</dd></div>
<div class="cap-form-boxes-box"><dt>Render version</dt><dd>${escapeXml(RENDER_VERSION)}</dd></div>
<div class="cap-form-boxes-box"><dt>Elements</dt><dd>${elements.length}</dd></div>
<div class="cap-form-boxes-box"><dt>Editorial pack</dt><dd>${editorialCount}</dd></div>
</dl>
</header>
<nav class="contents" aria-labelledby="contents-name">
<h2 id="contents-name">Elements</h2>
<ol class="cap-leader-index">
${contents}
${indexRow(elements.length + 1, "#outputs", "One source, three outputs", "page, feed, llms.txt")}
</ol>
</nav>
${elements.map((e, i) => elementSection(e, rendered[i]?.html ?? "", i + 1)).join("\n")}
${await outputsSection(version, elements.length + 1)}
</main>`;
  const index = documentHtml({
    title: "Prelum specimen",
    description: `Every element Prelum ${version} renders from markdown, with its source, in both themes.`,
    body,
    version,
  });
  assertUniqueIds(index);
  writeFileSync(join(outDir, "index.html"), index);

  writeFileSync(
    join(outDir, "404.html"),
    documentHtml({
      title: "Not found: Prelum specimen",
      description: "There is no page at this address.",
      body: `<main id="main" tabindex="-1">\n<h1>Not found</h1>\n<p>There is no page at this address. The specimen is at <a href="/">prelum.dustinedwards.info</a>, and the code at <a href="${REPO}">github.com/DrDustinEdwards/prelum</a>.</p>\n</main>`,
      version,
    }),
  );

  writeFileSync(join(outDir, "elements.json"), `${JSON.stringify(elementIndex(elements, version), null, 2)}\n`);

  // security.txt (site-runtime), the IndexNow key file, and a sitemap of the one page, which the deploy hands to
  // prelum-indexnow.
  mkdirSync(join(outDir, ".well-known"), { recursive: true });
  writeFileSync(
    join(outDir, ".well-known", "security.txt"),
    securityTxt({ origin: ORIGIN, contact: "security@dustinedwards.info", expires: SECURITY_TXT_EXPIRES }),
  );
  writeFileSync(join(outDir, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
  writeFileSync(join(outDir, "sitemap.xml"), sitemapDocument([{ loc: `${ORIGIN}/` }]));

  /** @type {string[]} */
  const files = [];
  const walk = (/** @type {string} */ dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else files.push(relative(outDir, path));
    }
  };
  walk(outDir);
  return { version, elements: elements.length, files: files.sort() };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] ?? join(HERE, "dist");
  const result = await buildSpecimen(outDir);
  console.log(`specimen: ${result.elements} elements, Prelum ${result.version}, ${result.files.length} files in ${relative(process.cwd(), outDir) || "."}`);
}
