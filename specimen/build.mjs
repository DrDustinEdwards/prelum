// Builds the specimen site at https://prelum.dustinedwards.info into specimen/dist (or the directory named): one page showing every
// element in specimen/elements as its markdown beside Prelum's output, what a short post becomes in an RSS item and in llms.txt, and
// elements.json, the index Carrel's Insert menu reads. Static files only, and no script on any page.
//
//   node specimen/build.mjs [outDir]

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { capsomerTheme } from "capsomer/enarratio-theme";
import { stylesheet } from "enarratio";

import { llmsDocument } from "../llms.mjs";
import { rssItem } from "../feeds.mjs";
import { RENDER_VERSION, render } from "../render.mjs";
import { DIAGRAM_ASSET_DIR, DIAGRAM_THEMES, diagramAssetPath } from "../render-diagram.mjs";
import { absolutizeUrls, escapeXml, mathToTex } from "../xml.mjs";
import { SITE_HEADERS } from "./headers.mjs";
import { ASSET_PREFIX, DIAGRAM_CONFIG_FILE, ORIGIN, diagramConfig, elementIndex, loadElements, options, renderElement, resolveImage, splitHeader } from "./specimen.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const require = createRequire(import.meta.url);
const REPO = "https://github.com/DrDustinEdwards/prelum";

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

/** The faces Capsomer's tokens name, latin only: the specimen is in English. */
const FONTS = [
  { family: "Schibsted Grotesk", file: "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-400-normal.woff2", weight: "400", style: "normal" },
  { family: "Schibsted Grotesk", file: "@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-600-normal.woff2", weight: "600", style: "normal" },
  { family: "Martian Mono", file: "@fontsource/martian-mono/files/martian-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
  { family: "Source Serif 4", file: "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2", weight: "200 900", style: "normal" },
  { family: "Source Serif 4", file: "@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2", weight: "200 900", style: "italic" },
];

/** @param {string} outDir */
function writeStyles(outDir) {
  mkdirSync(join(outDir, "fonts"), { recursive: true });
  const faces = FONTS.map((font) => {
    const name = font.file.split("/").pop() ?? "";
    copyFileSync(packageFile(font.file), join(outDir, "fonts", name));
    return `@font-face {\n  font-family: "${font.family}";\n  font-style: ${font.style};\n  font-weight: ${font.weight};\n  font-display: swap;\n  src: url("fonts/${name}") format("woff2");\n}`;
  });
  const capsomer = dirname(packageFile("capsomer/tokens.css"));
  const css = [
    "/* Built by specimen/build.mjs: Capsomer's fonts, tokens, base and prose styles, Enarratio's chart styles in Capsomer's theme, and specimen/site.css. */",
    ...faces,
    inlineCss(join(capsomer, "tokens.css")),
    inlineCss(join(capsomer, "base.css")),
    inlineCss(join(capsomer, "prose.css")),
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

/** @param {string} from @param {string} to */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyTree(join(from, entry.name), join(to, entry.name));
    else copyFileSync(join(from, entry.name), join(to, entry.name));
  }
}

/**
 * @param {{ title: string, description: string, body: string, version: string }} page
 */
function documentHtml({ title, description, body, version }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
<meta name="description" content="${escapeXml(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
<link rel="stylesheet" href="/katex/katex.min.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to the elements</a>
<div class="page">
${body}
<footer class="site-foot">
<p>Prelum ${escapeXml(version)}, render version ${escapeXml(RENDER_VERSION)}. <a href="${REPO}">The code on GitHub</a>. Styled with Capsomer; charts drawn by Enarratio.</p>
</footer>
</div>
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
 */
function elementSection(element, html) {
  const directives = element.directives.map((d) => `:${d}`).join(", ");
  const pack =
    element.pack === "editorial"
      ? `<span class="element-pack">editorial pack</span>`
      : `<span class="element-pack">core</span>`;
  const feed = feedForm(html);
  return `<section class="element" id="el-${element.id}" aria-labelledby="el-${element.id}-name">
<h2 class="element-name" id="el-${element.id}-name"><a href="#el-${element.id}">${escapeXml(element.name)}</a></h2>
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
 */
async function outputsSection(version) {
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
<h2 class="element-name" id="outputs-name"><a href="#outputs">One source, three outputs</a></h2>
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
  const headersFile = join(outDir, "_headers");
  writeFileSync(headersFile, readFileSync(headersFile, "utf8").replace("{{SITE_HEADERS}}", Object.entries(SITE_HEADERS).map(([name, value]) => `  ${name}: ${value}`).join("\n")));
  writeStyles(outDir);
  copyDiagrams(outDir, rendered.flatMap((r) => r.diagrams));

  const contents = elements.map((e) => `<li><a href="#el-${e.id}">${escapeXml(e.name)}</a></li>`).join("\n");
  const body = `<main id="main" tabindex="-1">
<header class="page-head">
<h1>Prelum specimen</h1>
<p class="page-lead">Every element Prelum renders from markdown, each source beside its output, in the configuration dustinedwards.info uses: the core, the editorial pack and code highlighting. The page follows your system's light or dark setting. The list is also at <a href="/elements.json">elements.json</a>, generated from the same sources.</p>
</header>
<nav class="contents" aria-labelledby="contents-name">
<h2 id="contents-name">Elements</h2>
<ol>
${contents}
<li><a href="#outputs">One source, three outputs</a></li>
</ol>
</nav>
${elements.map((e, i) => elementSection(e, rendered[i]?.html ?? "")).join("\n")}
${await outputsSection(version)}
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
