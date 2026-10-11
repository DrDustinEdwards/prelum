// The specimen site (specimen/): each element renders to the output stored beside it, the elements cover everything Prelum can
// produce, and the built site carries the index Carrel reads and names Prelum's version.
//
// UPDATE_SPECIMEN=1 npm test rewrites specimen/expected/ from the current output. Review the diff: a changed file is a change in
// what every site publishes for that markdown, and belongs with a RENDER_VERSION bump.

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import { CHART_TYPES } from "../render-chart.mjs";
import { LANGUAGES } from "../render-highlight.mjs";
import { buildSpecimen } from "../specimen/build.mjs";
import { EXPECTED_DIR, PACKS, expectedPath, loadElements, renderElement } from "../specimen/specimen.mjs";

const elements = loadElements();
const update = process.env.UPDATE_SPECIMEN === "1";

for (const element of elements) {
  test(`specimen element ${element.id} renders to its stored expected output`, async () => {
    const { html } = await renderElement(element);
    if (update) {
      writeFileSync(expectedPath(element.id), `${html}\n`);
      return;
    }
    assert.equal(
      `${html}\n`,
      readFileSync(expectedPath(element.id), "utf8"),
      `specimen/elements/${element.file} no longer renders to specimen/expected/${element.id}.html`,
    );
  });
}

test("every element has a stored expected output, and every stored output an element", () => {
  const stored = readdirSync(EXPECTED_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.slice(0, -".html".length))
    .sort();
  assert.ok(elements.length > 0, "no elements read");
  assert.deepEqual(stored, elements.map((e) => e.id).sort());
});

/**
 * The fenced code languages and chart types the elements use, from their parse.
 */
function used() {
  /** @type {Set<string>} */
  const languages = new Set();
  /** @type {Set<string>} */
  const charts = new Set();
  for (const element of elements) {
    const tree = unified().use(remarkParse).use(remarkDirective).parse(element.source);
    visit(tree, (node, _index, parent) => {
      if (node.type === "code" && node.lang && parent?.type !== "containerDirective") languages.add(node.lang);
      if (node.type === "containerDirective" && node.name === "chart" && node.attributes?.type) charts.add(node.attributes.type);
    });
  }
  return { languages, charts };
}

test("the elements cover every directive, chart type and highlighted language Prelum has, and nothing it lacks", () => {
  const { languages, charts } = used();
  const directives = new Set(elements.flatMap((e) => e.directives));
  assert.deepEqual([...directives].sort(), [...PACKS.core, ...PACKS.editorial].sort(), "directives");
  assert.deepEqual([...charts].sort(), [...CHART_TYPES].sort(), "chart types");
  assert.deepEqual([...languages].sort(), [...LANGUAGES].sort(), "highlighted languages");
});

test("the built site carries the index generated from the sources, names Prelum's version, and has no generator tag", async () => {
  const out = mkdtempSync(join(tmpdir(), "prelum-specimen-"));
  try {
    const { version, files } = await buildSpecimen(out);
    assert.equal(version, JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version);

    const index = JSON.parse(readFileSync(join(out, "elements.json"), "utf8"));
    assert.equal(index.prelum, version);
    assert.deepEqual(
      index.elements.map((/** @type {{ id: string, markdown: string, pack: string }} */ e) => [e.id, e.markdown, e.pack]),
      elements.map((e) => [e.id, e.source.trimEnd(), e.pack]),
    );
    assert.ok(index.elements.some((/** @type {{ pack: string }} */ e) => e.pack === "editorial"), "no element needs the editorial pack");

    const pages = files.filter((f) => f.endsWith(".html"));
    assert.deepEqual(pages.sort(), ["404.html", "index.html"]);
    for (const page of pages) {
      const html = readFileSync(join(out, page), "utf8");
      assert.doesNotMatch(html, /<meta[^>]+name="generator"/i, `${page} carries a generator tag`);
      assert.doesNotMatch(html, /<script/i, `${page} carries a script`);
      assert.match(html, new RegExp(`<footer class="site-foot">\\s*<p>Prelum ${version.replace(/\./g, "\\.")},`), `${page} footer`);
    }
    const page = readFileSync(join(out, "index.html"), "utf8");
    for (const element of elements) assert.ok(page.includes(`id="el-${element.id}"`), `index.html shows ${element.id}`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
