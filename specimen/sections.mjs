// The specimen's page sections: one per element, with its rendered output and the feeds and files made from it.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { llmsDocument } from "../llms.mjs";
import { rssItem } from "../feeds.mjs";
import { render } from "../render.mjs";
import { wrapRendered } from "../stored-render.mjs";
import { absolutizeUrls, escapeXml, mathToTex } from "../xml.mjs";
import { ORIGIN, options, resolveImage, splitHeader } from "./specimen.mjs";

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
export function elementSection(element, html, no) {
  const directives = element.directives.map((d) => `:${d}`).join(", ");
  const pack =
    element.pack === "editorial"
      ? `<span class="element-pack">editorial pack</span>`
      : `<span class="element-pack">core</span>`;
  const feed = feedForm(html);
  return `<section class="element" id="el-${element.id}" aria-labelledby="el-${element.id}-name">
<h2 class="element-name cap-part-title" id="el-${element.id}-name"><span class="cap-part-no">${no}</span><a href="#el-${element.id}">${escapeXml(element.name)}</a></h2>
<p class="element-meta">${element.summary ? `${escapeXml(element.summary)} ` : ""}${pack}${directives ? ` <span class="sr-only">directives:</span> <code>${escapeXml(directives)}</code>` : ""}</p>
<div class="pair">
<div>
<p class="pair-label">Markdown</p>
<pre class="source" tabindex="0"><code>${escapeXml(element.source.trimEnd())}</code></pre>
</div>
<div>
<p class="pair-label">Output</p>
<div class="output prose" data-context="prose">
${wrapRendered(html)}
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
 * @param {{ taken: boolean }} priority the page's
 */
export async function outputsSection(version, no, priority) {
  const text = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "sample-post.md"),
    "utf8",
  );
  const { header: meta, source: body } = splitHeader("specimen/sample-post.md", text, [
    "title",
    "slug",
    "description",
    "date",
  ]);
  const { html } = await render({
    file: "specimen/sample-post.md",
    body,
    resolveImage,
    options: { ...options, priority },
  });
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
    sections: [
      {
        heading: "Writing",
        links: [{ title: post.title, url: link, description: meta.description }],
      },
    ],
  });
  return `<section class="outputs" id="outputs" aria-labelledby="outputs-name">
<h2 class="element-name cap-part-title" id="outputs-name"><span class="cap-part-no">${no}</span><a href="#outputs">One source, three outputs</a></h2>
<div class="pair">
<div>
<p class="pair-label">Markdown</p>
<pre class="source" tabindex="0"><code>${escapeXml(text.trimEnd())}</code></pre>
</div>
<div>
<p class="pair-label">Page</p>
<div class="output prose" data-context="prose">
${wrapRendered(html)}
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
export function assertUniqueIds(html) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const [, id] of html.matchAll(/\sid="([^"]+)"/g))
    counts.set(/** @type {string} */ (id), (counts.get(/** @type {string} */ (id)) ?? 0) + 1);
  const repeated = [...counts].filter(([, n]) => n > 1).map(([id]) => id);
  if (repeated.length > 0)
    throw new Error(`the specimen page repeats the id ${repeated.join(", ")}`);
}
