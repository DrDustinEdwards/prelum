// The markdown pipeline's behavior: what it returns, what it refuses and says why, and that the parts a site injects (media, packs,
// highlighting) are the only parts that know about the site.

import assert from "node:assert/strict";
import test from "node:test";
import { UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";

import { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, RENDER_VERSION, ContentError, render } from "../render.mjs";
import { htmlHasMath } from "../render-math.mjs";
import { render as renderNoMath } from "../render-nomath.mjs";
import { linkIconResponse, lookupLinkIcon } from "../render-link-icons.mjs";
import { isAllowedUrl } from "../render-url.mjs";
import { editorialPack } from "../render-packs.mjs";
import { fixture, highlight, media, resolveImage, siteOptions } from "./render-config.mjs";

/** @param {string} body @param {import("../render.mjs").RenderOptions} [options] */
const core = (body, options = {}) => render({ file: "post.md", body, resolveImage, options });

/** @param {string} body */
const site = (body) => core(body, siteOptions);

/** @param {Promise<unknown>} promise @param {RegExp} message */
const refuses = (promise, message) =>
  assert.rejects(promise, (error) => error instanceof ContentError && message.test(error.message));

test("render returns the contract: a fragment, the outline, and what the page cites", async () => {
  const result = await site(fixture("prose"));

  assert.deepEqual(Object.keys(result).sort(), [
    "blockedUrls",
    "diagrams",
    "excerpt",
    "faq",
    "hasMath",
    "html",
    "mediaRefs",
    "postLinks",
    "readingMinutes",
    "renderVersion",
    "toc",
    "warnings",
    "words",
  ]);
  assert.equal(result.renderVersion, RENDER_VERSION);
  assert.doesNotMatch(result.html, /<html|<body|<head/);
  assert.deepEqual(result.toc, [
    { depth: 2, id: "second-heading", text: "Second heading" },
    { depth: 3, id: "third-heading", text: "Third heading" },
  ]);
  assert.deepEqual(result.blockedUrls, []);
  assert.equal(result.hasMath, false);
});

test("an image the site has no size for is written unsized, not refused", async () => {
  const { html } = await renderNoMath({ file: "post.md", body: "![A fox](https://example.com/fox.png)", resolveImage: async () => null });
  assert.match(html, /<img src="https:\/\/example\.com\/fox\.png" alt="A fox" loading="eager"/);
  assert.doesNotMatch(html, /width=/);
});

test("render is deterministic: the same input is the same bytes, run after run", async () => {
  for (const name of ["prose", "math", "code", "directives"]) {
    const first = await site(fixture(name));
    const second = await site(fixture(name));
    assert.equal(second.html, first.html, name);
  }
});

test("render needs no site: the core renders without media, packs or highlighting", async () => {
  const { html, mediaRefs } = await core(fixture("prose"));
  assert.match(html, /<h2 id="second-heading">/);
  assert.match(html, /<div class="table-scroll" tabindex="0" role="region" aria-label="Table: [^"]+"><table>/);
  assert.match(html, /<img src="\/media\/example-sample-0123456789abcdef-640x480.png"/);
  assert.doesNotMatch(html, /srcset=/);
  assert.deepEqual(mediaRefs, []);
});

test("headings get an id, a keyboard-reachable anchor named for the heading, and an outline entry; footnotes do not", async () => {
  const { html, toc } = await core("## Methods & `code`\n\ntext[^1]\n\n[^1]: note");
  assert.match(html, /<h2 id="methods--code">Methods &#x26; <code>code<\/code><a class="heading-anchor" aria-label="Link to section: Methods &#x26; code" href="#methods--code">#<\/a><\/h2>/);
  assert.deepEqual(toc, [{ depth: 2, id: "methods--code", text: "Methods & code" }]);
  // The outline is read before the anchor's "#" is added, so a heading's own "#" stays.
  assert.equal((await core("## Learning C#")).toc[0]?.text, "Learning C#");
});

test("a task-list checkbox is named by its item's first line, wrapped in a label, so a screen reader says what is done", async () => {
  const tight = (await core("- [x] Draft **written**\n- [ ] Figures checked\n  - [ ] nested\n")).html;
  assert.match(tight, /<label><input type="checkbox" checked disabled> Draft <strong>written<\/strong><\/label>/);
  // The nested list is outside the parent's label and has its own.
  assert.match(tight, /<label><input type="checkbox" disabled> Figures checked<\/label>\n<ul/);
  assert.match(tight, /<label><input type="checkbox" disabled> nested<\/label>/);

  // A loose item: the label is the first paragraph's, and the paragraphs after it are not part of the name.
  const loose = (await core("- [ ] Task with $x^2$\n\n  More text.\n\n- [ ] ![a chart](/media/c.png)\n")).html;
  assert.match(loose, /<p><label><input type="checkbox" disabled> Task with <span class="katex">[\s\S]*?<\/span><\/label><\/p>\n<p>More text.<\/p>/);
  assert.match(loose, /<label><input type="checkbox" disabled> (?:<a [^>]*>)?<img[^>]*alt="a chart"[^>]*>(?:<\/a>)?<\/label>/);

  for (const html of [tight, loose]) {
    assert.equal((html.match(/<input/g) ?? []).length, (html.match(/<label><input/g) ?? []).length, html);
  }
});

test("math is validated, flagged, and rendered as MathML plus HTML", async () => {
  const withMath = await core(fixture("math"));
  assert.equal(withMath.hasMath, true);
  assert.equal(htmlHasMath(withMath.html), true);
  assert.match(withMath.html, /<annotation encoding="application\/x-tex">/);
  assert.equal(htmlHasMath((await core("no math here")).html), false);
  assert.equal(htmlHasMath(null), false);
});

test("math KaTeX cannot render stops the render and names the line and the expression", async () => {
  await refuses(core("one\n\ntwo $\\notacommand{x}$ three"), /KaTeX cannot render the inline expression on line 3 of the body: .*The expression is: \\notacommand\{x\}/s);
  await refuses(core("$$\n\\frac{1}\n$$"), /KaTeX cannot render the display expression on line 1 of the body/);
});

test("render/nomath leaves dollars as text", async () => {
  const { html, hasMath } = await renderNoMath({ file: "post.md", body: "Awards of $3,000 to $6,500.", resolveImage });
  assert.equal(html, "<p>Awards of $3,000 to $6,500.</p>");
  assert.equal(hasMath, false);
});

test("a link outside the allowed protocols is shown as the markdown that wrote it", async () => {
  assert.equal(isAllowedUrl("https://example.com"), true);
  assert.equal(isAllowedUrl("mailto:a@example.com"), true);
  assert.equal(isAllowedUrl("/relative#fragment"), true);
  assert.equal(isAllowedUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedUrl("java\tscript:alert(1)"), false);
  assert.equal(isAllowedUrl("%6Aavascript:alert(1)"), false);
  assert.equal(isAllowedUrl("data:text/html,x"), false);
  assert.equal(isAllowedUrl("vbscript:x"), false);
  assert.equal(isAllowedUrl("file:///etc/passwd"), false);

  const { html, blockedUrls } = await core("a [click *here*](vbscript:x) b");
  assert.equal(html, "<p>a [click here](vbscript:x) b</p>");
  assert.deepEqual(blockedUrls, [{ file: "post.md", tag: "a", url: "vbscript:x" }]);
});

test("prose that looks like a directive stays prose; an unknown directive is refused with the line and the known names", async () => {
  const { html } = await core("Meet at 12:30, ratio 4.5:1, see localhost:8080.");
  assert.equal(html, "<p>Meet at 12:30, ratio 4.5:1, see localhost:8080.</p>");

  await refuses(core("one\n\n:::figrue{src=\"/a.png\" alt=\"x\"}\n:::"), /unknown directive ":::figrue" on line 3\. Known directives: details, figure, lang, xref, abbr, /);
  await refuses(core("see :alert here"), /unknown directive ":alert" on line 1/);
  await refuses(core(":::chart{type=\"bar\"}\n:::"), /unknown directive ":::chart"/);
});

test("figure requires a source and alt text, and carries a caption and a credit", async () => {
  await refuses(core(":::figure{alt=\"x\"}\n:::"), /:::figure requires a src attribute/);
  await refuses(core(":::figure{src=\"/a.png\"}\n:::"), /:::figure \/a\.png requires an alt attribute/);

  const { html } = await core(':::figure{src="/a.png" alt="A thing" credit="Someone"}\nThe *caption*.\n:::');
  assert.match(html, /<figure><a class="image-link" href="\/a\.png"><img src="\/a\.png" alt="A thing" width="800" height="600" loading="eager"/);
  assert.match(html, /<figcaption><p>The <em>caption<\/em>\.<\/p><span class="figure-credit">Someone<\/span><\/figcaption>/);

  // A credit alone still gets a figcaption; no credit and no caption gets none.
  const credited = await core(':::figure{src="/a.png" alt="A thing" credit="Someone"}\n:::');
  assert.match(credited.html, /<figcaption><span class="figure-credit">Someone<\/span><\/figcaption>/);
  const bare = await core(':::figure{src="/a.png" alt="A thing"}\n:::');
  assert.doesNotMatch(bare.html, /figcaption/);

  // A dark twin: both images, each themed, neither wrapped in a link (the hidden half would be a focusable link with no name).
  const themed = await core(':::figure{src="/a.svg" dark="/a-dark.svg" alt="A thing"}\n:::');
  assert.match(themed.html, /^<figure><img src="\/a\.svg" alt="A thing" class="figure-light" width="800" height="600"[^>]*><img src="\/a-dark\.svg" alt="A thing" class="figure-dark" width="800" height="600"[^>]*><\/figure>$/);
});

test("images: a srcset or placeholder outside the policy is dropped, since both are written after the URL check", async () => {
  const hostile = {
    keyOf: () => null,
    imageProps: () => ({ srcSet: "/a.png 1x, javascript:alert(1) 2x", sizes: "100vw" }),
  };
  const { html } = await render({
    file: "post.md",
    body: "![a](/a.png)",
    resolveImage: async () => ({ width: 10, height: 10, placeholder: 'x" onerror="alert(1)' }),
    options: { media: hostile },
  });
  assert.doesNotMatch(html, /srcset|style=|onerror|javascript/);
  assert.match(html, /<img src="\/a\.png" alt="a" width="10" height="10"/);
});

test("details requires a summary and refuses a heading inside, which would hide a section", async () => {
  await refuses(core(":::details\nx\n:::"), /:::details requires a summary attribute/);
  await refuses(core(':::details{summary="More"}\n## Hidden\n:::'), /:::details holds a heading on line 2/);
  const { html, toc } = await core(':::details{summary="More"}\nbody\n:::');
  assert.equal(html, '<details class="post-details"><summary>More</summary><p>body</p></details>');
  assert.deepEqual(toc, []);
});

test("images: the site's media rules decide srcset, the wrapping link and the citation; the first image is eager", async () => {
  const body = "![one](/media/example-a-0123456789abcdef-640x480.png)\n\n![two](/static/b.png)\n\n![three](/media/example-c-fedcba9876543210-100x100.png)\n\n![](/static/rule.svg)";
  const { html, mediaRefs } = await core(body, { media });

  // AVIF first, so a browser that reads it takes it; the <img> keeps the WebP srcset for the rest.
  assert.match(html, /<a class="image-link" href="\/media\/example-a-0123456789abcdef-640x480\.png"><picture><source type="image\/avif" srcset="[^"]+\?w=640&#x26;f=avif 640w, [^"]+" sizes="[^"]+"><source type="image\/webp" srcset="[^"]+\?w=640 640w, [^"]+" sizes="[^"]+"><img src="[^"]+" alt="one" srcset="\/media\/[^"]+\?w=640 640w, [^"]+ 1024w, [^"]+ 1408w" sizes="\(min-width: 46rem\) 704px, calc\(100vw - 2rem\)" width="640" height="480" loading="eager" decoding="async" fetchpriority="high" class="has-lqip" style="background-image:url\(&#x22;data:image\/webp;base64,/);
  // Not a media image: no srcset, no placeholder, and the link goes to the image itself.
  assert.match(html, /<a class="image-link" href="\/static\/b\.png"><img src="\/static\/b\.png" alt="two" width="800" height="600" loading="lazy" decoding="async"><\/a>/);
  // A decorative image (alt "") is not wrapped: a link around it would have no name.
  assert.match(html, /<p><img src="\/static\/rule\.svg" alt="" width="800" height="600" loading="lazy" decoding="async"><\/p>/);
  assert.equal((html.match(/fetchpriority/g) ?? []).length, 1);
  assert.deepEqual(
    mediaRefs.map(({ key, form, detail }) => ({ key, form, detail })),
    [
      { key: "example-a-0123456789abcdef-640x480.png", form: "markdown-image", detail: "line 1" },
      { key: "example-c-fedcba9876543210-100x100.png", form: "markdown-image", detail: "line 5" },
    ],
  );
});

test("an author's own link around an image wins, and the image is not wrapped twice", async () => {
  const { html } = await core("[![x](/a.png)](https://example.com)");
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.match(html, /<a href="https:\/\/example\.com"><img src="\/a\.png"/);
});

test("every way a page can cite media is collected, figure directives included", async () => {
  const body = [
    "[link](/media/k1.png)",
    "![img](/media/k2.png)",
    '<img src="/media/k3.png">',
    '[ref][r]',
    '[r]: /media/k4.png',
    '![pic][i]',
    '[i]: /media/k7.png',
    ':::figure{src="/media/k5.png" dark="/media/k6.png" alt="x"}',
    ":::",
  ].join("\n\n");
  const { mediaRefs } = await core(body, { media });
  const found = Object.fromEntries(mediaRefs.map(({ key, form }) => [key, form]));
  assert.deepEqual(found, {
    "k1.png": "link",
    "k2.png": "markdown-image",
    "k3.png": "html",
    "k4.png": "link",
    "k5.png": "figure-directive",
    "k6.png": "figure-directive",
    "k7.png": "markdown-image",
  });
});

test("code is plain without a highlighter, and highlighted, labeled and line-marked with one", async () => {
  const plain = await core("```js\nlet a\n```");
  assert.equal(plain.html, '<pre tabindex="0" role="region" aria-label="Code: JavaScript"><code class="language-js">let a\n</code></pre>');

  const { html } = await core(fixture("code"), { highlight });
  assert.match(html, /<pre class="shiki shiki-themes github-light-high-contrast github-dark-high-contrast" style="[^"]*" data-lang="js" tabindex="0" role="region" aria-label="Code: JavaScript">/);
  assert.match(html, /data-lang="bash"/);
  assert.match(html, /<span class="line highlighted">/);
  assert.match(html, /data-lang="text"/);
  assert.match(html, /--shiki-light:#[0-9a-f]{6};--shiki-dark:#[0-9a-f]{6}/i);
});

test("a source over the byte limit is refused before it is parsed, and the limit is the site's to set", async () => {
  assert.equal(DEFAULT_MAX_BYTES, 512 * 1024);
  await refuses(core("é".repeat(10), { maxBytes: 19 }), /source is 20 bytes and the limit is 19/);
  await core("é".repeat(10), { maxBytes: 20 });
  const started = performance.now();
  await refuses(core("x".repeat(DEFAULT_MAX_BYTES + 1)), /source is 524289 bytes and the limit is 524288/);
  assert.ok(performance.now() - started < 1000, "refused without rendering");
});

test("markdown nested past the depth limit is refused, with the line, instead of exhausting the stack", async () => {
  assert.equal(DEFAULT_MAX_DEPTH, 100);
  await refuses(core("> ".repeat(150) + "deep"), /nested more than 100 levels deep at line 1 of the body/);
  await core("> ".repeat(20) + "fine");
  await refuses(core("> > > deep", { maxDepth: 3 }), /nested more than 3 levels deep/);
});

test("packs: a site's own directives are known to the guard, run in order, and add to the result", async () => {
  /** @type {import("../render-packs.mjs").RenderPack} */
  const shout = {
    name: "shout",
    directives: ["shout"],
    setup: ({ file }) => ({
      remark: [
        [
          () => (/** @type {any} */ tree) => {
            for (const child of tree.children) {
              if (child.type === "containerDirective" && child.name === "shout") {
                child.data = { hName: "strong", hProperties: { className: ["shout"] } };
              }
            }
          },
        ],
      ],
      rehype: [],
      result: () => ({ shoutedIn: file }),
    }),
  };
  const result = await core(":::shout\nhey\n:::", { packs: [shout] });
  assert.equal(result.html, '<strong class="shout"><p>hey</p></strong>');
  assert.equal(/** @type {any} */ (result).shoutedIn, "post.md");
  await refuses(core(":::shout\nhey\n:::"), /unknown directive ":::shout"/);
});

test("a pack may add to the result but cannot replace the fields that are the contract", async () => {
  /** @type {import("../render-packs.mjs").RenderPack} */
  const greedy = {
    name: "greedy",
    directives: [],
    setup: () => ({ remark: [], rehype: [], result: () => ({ html: "stolen", toc: "stolen", renderVersion: "0", extra: 1 }) }),
  };
  const result = await core("# Real", { packs: [greedy] });
  // An h1 in the body moves down a level: the page's title is the h1.
  assert.match(result.html, /^<h2 id="real">/);
  assert.deepEqual(result.toc, [{ depth: 2, id: "real", text: "Real" }]);
  assert.equal(result.renderVersion, RENDER_VERSION);
  assert.equal(/** @type {any} */ (result).extra, 1);
});

test("the editorial pack: sidenotes, pull quotes, swatches, charts and diagrams, each refused with a reason when misused", async () => {
  const { html, diagrams } = await site(fixture("directives"));

  assert.match(html, /<aside class="post-note" id="sn-1"><b class="post-note-kind">Fallback<\/b>/);
  assert.match(html, /<p class="pull-quote" aria-hidden="true">sentence worth raising<\/p>/);
  assert.match(html, /<span class="swatch"><span class="swatch-chip" style="--swatch:#6B4FBB" aria-hidden="true"><\/span><code class="swatch-label">#6B4FBB<\/code><\/span>/);
  assert.match(html, /<span class="swatch-chip" style="--swatch:#FFF" aria-hidden="true"><\/span><code class="swatch-label">the brand<\/code>/);
  assert.equal((html.match(/<div class="cap-chart" data-prelum-chart="[^"]*"><div class="cap-chart-figure"><figure class="chart-figure enarratio"/g) ?? []).length, 2);
  assert.match(html, /src="\/diagrams\/example-4efabcc1-light\.svg"/);
  assert.match(html, /src="\/diagrams\/example-4efabcc1-dark\.svg"/);
  assert.deepEqual(diagrams, [{ key: "4efabcc1", source: "graph TD\n  A --> B" }]);

  // A hex in the attribute with no label falls back to the hex as the label, the second channel for the color.
  assert.match((await site(":swatch{color=#fff}")).html, /<code class="swatch-label">#FFF<\/code>/);
  // A pull quote that cannot be raised is refused, not left as a block <div> in the middle of a sentence.
  await refuses(site("- a :pullquote[hello there] b"), /:pullquote on line 1 of the body is not in a top-level paragraph/);
  await refuses(site("> a :pullquote[hello there] b"), /is not in a top-level paragraph/);
  await refuses(site(":swatch[red]"), /:swatch on line 1 of the body cannot use "red" as a color/);
  await refuses(site(":swatch[]"), /carries no color/);
  await refuses(site("A :pullquote[one] and :pullquote[two] here."), /one paragraph carries 2 pull quotes/);
  await refuses(site(`A :pullquote[${"x".repeat(161)}] here.`), /is 161 characters and the limit is 160/);
  await refuses(site("A.\n\nB :pullquote[b].\n\nC :pullquote[c].\n\nD :pullquote[d]."), /pull quote number 3 and the limit is 2/);
  await refuses(site(":::sidenote\nx\n:::"), /:::sidenote requires a kind attribute/);
  await refuses(site(':::sidenote{kind="K"}\n# H\n:::'), /:::sidenote holds a heading on line 2/);
  await refuses(site(':::chart{type="bar" x="a" y="b"}\n```csv\na,b\n1,2\n```\n:::'), /:::chart "bar" requires an alt attribute/);
  await refuses(site(':::chart{type="pie" alt="x"}\n```csv\na,b\n1,2\n```\n:::'), /:::chart type "pie" is not one of bar, line, dot, area/);
  await refuses(site(':::chart{type="bar" x="a" y="b" alt="x" src="/media/a.csv"}\n:::'), /passes no chartData loader/);
  await refuses(site(':::diagram{alt="x"}\n```text\nA\n```\n:::'), /source must be a ```mermaid fenced block, found ```text/);
  await refuses(site(':::diagram{title="T"}\n```mermaid\nA-->B\n```\n:::'), /:::diagram "T" requires an alt attribute/);
});

test("a chart's data may come from the site's loader (E3), and strict charts refuse what the default only warns about (E4)", async () => {
  const pack = (/** @type {object} */ extra) => ({ packs: [editorialPack({ assetPrefix: "x-", ...extra })] });
  /** @type {string[]} */
  const asked = [];
  const chartData = async (/** @type {string} */ src) => {
    asked.push(src);
    if (src.endsWith("missing.csv")) throw new Error("404");
    return "year,posts\r\n2024,3\r\n2025,5\r\n";
  };
  const cited = ':::chart{type="bar" x="year" y="posts" alt="Posts rose from 3 to 5" src="/media/posts.csv"}\n:::';
  const { html, warnings } = await core(cited, pack({ chartData }));
  assert.deepEqual(asked, ["/media/posts.csv"]);
  assert.match(html, /<td>5<\/td>/);
  await refuses(core(cited.replace("posts.csv", "missing.csv"), pack({ chartData })), /src="\/media\/missing.csv" did not load: 404/);
  await refuses(core(cited.replace("\n:::", "\n```csv\na,b\n1,2\n```\n:::"), pack({ chartData })), /holds a CSV block; give the data one way/);
  // No title: a warning by default, a refusal when strict.
  assert.ok(warnings.some((w) => /title/i.test(w.message)), JSON.stringify(warnings));
  await refuses(core(cited, pack({ chartData, strictCharts: true })), /:::chart "bar": .*title/i);
});

test("diagram assets are named by the site's prefix, and the key moves with the source, not with line endings", async () => {
  const lf = await core(':::diagram{alt="x"}\n```mermaid\ngraph TD\n  A --> B\n```\n:::', {
    packs: [(await import("../render-packs.mjs")).editorialPack({ assetPrefix: "other-" })],
  });
  const crlf = await core(':::diagram{alt="x"}\n```mermaid\r\ngraph TD\r\n  A --> B\r\n```\n:::', {
    packs: [(await import("../render-packs.mjs")).editorialPack({ assetPrefix: "other-" })],
  });
  assert.match(lf.html, /src="\/diagrams\/other-4efabcc1-light\.svg"/);
  assert.deepEqual(crlf.diagrams, lf.diagrams);
});

test("the blocks every site gets: callouts, media, embeds, galleries, links, FAQs and inline marks, each refused with a reason when misused", async () => {
  const result = await site(fixture("blocks"));
  const { html } = result;

  assert.match(html, /<div class="callout callout-note" role="note">\n?<p class="callout-title">Note<\/p>/);
  assert.match(html, /<p class="callout-title">Read this first<\/p>/);
  assert.match(html, /<kbd>Ctrl<\/kbd>.*<abbr title="HyperText Markup Language">HTML<\/abbr>.*<mark>highlight<\/mark>, H<sub>2<\/sub>O/);
  // A lone tilde is prose, and SmartyPants curls quotes and writes TeX's dashes.
  assert.match(html, /H~2~O stays prose, “quotes” curl – and dashes—too…/);
  assert.match(html, /<video [^>]*controls preload="metadata"[^>]*aria-label="A short demo"><track kind="captions"/);
  assert.match(html, /<figure class="media media-video width-wide">/);
  assert.match(html, /<a href="\/writing\/talk-transcript">Transcript: A talk<\/a>/);
  // No request to the service until a click: a link with the no-cookie player beside it.
  assert.match(html, /<a class="embed-link" href="https:\/\/www\.youtube\.com\/watch\?v=dQw4w9WgXcQ" data-embed-src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1"/);
  assert.equal((html.match(/<li><a class="image-link"/g) ?? []).length, 2);
  assert.match(html, /<figcaption>Two pictures side by side\.<\/figcaption>/);
  assert.match(html, /<p class="button-row"><a href="\/join" class="button">Join the list<\/a><\/p>/);
  assert.match(html, /<span class="bookmark-host">ghost\.org<\/span>/);
  assert.match(html, /<figure class="code-frame"><figcaption class="code-title">example\.js<\/figcaption><pre[^>]* aria-label="Code: example\.js">/);
  assert.deepEqual(result.faq, [
    { question: "What is this?", answer: "A fixture." },
    { question: "Does an answer run on?", answer: "It runs on over the next line." },
  ]);
  assert.ok(result.mediaRefs.some((ref) => ref.form === "media-directive" && ref.key.endsWith(".vtt")));
  assert.ok(result.words > 60 && result.readingMinutes === 1, `${result.words} words`);

  const linked = await core("See ::postlink[old|that post] and ::postlink[gone].\n\n:::faq\nQ: Where?\nA: In ::postlink[old].\n:::", {
    postLink: async (slug) => (slug === "old" ? { url: "/writing/new", title: "New" } : null),
  });
  assert.match(linked.html, /<a href="\/writing\/new">that post<\/a> and <code>::postlink\[gone\]<\/code>/);
  assert.deepEqual(linked.postLinks, ["old", "gone"]);
  // Foxhound's live FAQ showed ::postlink[…] as text: the answer links on the page and reads as words in the JSON-LD.
  assert.match(linked.html, /<dd>In <a href="\/writing\/new">New<\/a>\.<\/dd>/);
  assert.deepEqual(linked.faq, [{ question: "Where?", answer: "In New." }]);

  const outline = await core("Intro words here.\n\n## A\n\n#### Too deep\n\n![](/x.png)");
  assert.deepEqual(outline.warnings.map((w) => w.line), [5, 7]);
  assert.equal(outline.excerpt, "Intro words here.");

  await refuses(core("![a clip](/media/clip.mp4)"), /links \/media\/clip\.mp4, a video or audio file\. Write :::video or :::audio/);
  await refuses(core(':::video{src="/a.mp4" title="x"}\n:::'), /requires a captions attribute/);
  await refuses(core('::audio{src="/a.mp3" title="x"}'), /requires a transcript attribute/);
  await refuses(core('::embed[x]{url="https://example.com/v"}'), /cannot embed .* Embeds come from youtube, vimeo, spotify, soundcloud/);
  await refuses(core('::embed{url="https://youtu.be/dQw4w9WgXcQ"}'), /requires a title/);
  await refuses(core(":::gallery\n![one](/a.png)\n:::"), /holds 1 images; a gallery takes 2 to 9/);
  await refuses(core(':::figure{src="/a.png" alt="x" width=huge}\n:::'), /use width=wide or width=full/);
  await refuses(core(":abbr[HTML]"), /requires a title attribute/);
});

test("a link's kind is read only from what marks it: a path's extension, the whole text, a paragraph of its own", async () => {
  const { html } = await core(
    "[q](https://example.com/get?format=pdf) [tld](https://example.zip) [own](https://www.dustinedwards.info/a) " +
      "[mail](mailto:a@example.com?subject=Hi) [r](/report.PDF)\n\n- [a](/one)\n\n- [b](/two)\n\n[![x](/a.png)](/b)",
    { links: { origin: "https://dustinedwards.info" } },
  );
  // Away, not file: the extension is the query's, and .zip is the host's.
  assert.match(html, /<a href="https:\/\/example.com\/get\?format=pdf" data-link="away" rel="external">/);
  assert.match(html, /<a href="https:\/\/example.zip" data-link="away" rel="external">/);
  assert.match(html, /<a href="https:\/\/www.dustinedwards.info\/a">own<\/a>/);
  assert.match(html, /data-link="email">mail</);
  assert.match(html, /data-link="file">r<\/a> <span class="cap-link-meta">PDF<\/span>/);
  // A loose list's paragraphs and a linked picture are not "next".
  assert.doesNotMatch(html, /data-link="next"/);
  // Without the site's origin nothing is called away: its own absolute links would be.
  assert.doesNotMatch((await core("See [x](https://example.com/).")).html, /data-link/);
  await refuses(core(":lang[[x](/es/)]{hreflang=not_a_tag}"), /:lang on line 1 of the body needs a language tag/);
  await refuses(core(":xref[the headings]"), /:xref on line 1 of the body holds exactly one link/);
});

// The away links' icon step. The network is a fake; nothing here reaches another site.
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** @param {Record<string, string | Uint8Array>} routes */
function fakeNetwork(routes) {
  /** @type {string[]} */
  const asked = [];
  /** @type {typeof globalThis.fetch} */
  const fetch = async (input) => {
    const url = String(input);
    asked.push(url);
    const body = routes[url];
    return body === undefined ? new Response("no", { status: 404 }) : new Response(/** @type {BodyInit} */ (body));
  };
  /** @type {Map<string, { bytes: Uint8Array, type: string }>} */
  const kept = new Map();
  const store = {
    /** @param {string} host */
    get: async (host) => kept.get(host) ?? null,
    /** @param {string} host @param {Uint8Array} bytes @param {string} type */
    put: async (host, bytes, type) => void kept.set(host, { bytes, type }),
  };
  return { fetch, store, asked, kept };
}

test("an icon is the host's own, fetched once, and anything the step cannot vouch for is refused and remembered as none", async () => {
  const net = fakeNetwork({
    "https://a.example/": '<head><link href="/i.png?v=1&amp;x=2" rel="shortcut icon"></head>',
    "https://a.example/i.png?v=1&x=2": PNG,
    "https://b.example/favicon.ico": '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    "https://c.example/favicon.ico": Uint8Array.from({ length: 70 * 1024 }, (_, i) => PNG[i] ?? 0),
  });
  assert.equal(await lookupLinkIcon("a.example", net), "image/png");
  assert.equal(await lookupLinkIcon("a.example", net), "image/png");
  assert.equal(net.asked.filter((url) => url.startsWith("https://a.example/")).length, 3, "favicon.ico, the page, its icon; then the store");
  // A script in an SVG, and an icon over the cap: refused, and stored empty so the next publish does not ask again.
  assert.equal(await lookupLinkIcon("b.example", net), null);
  assert.equal(await lookupLinkIcon("c.example", net), null);
  assert.equal(net.kept.get("b.example")?.type, "");
  // Never a private address.
  assert.equal(await lookupLinkIcon("localhost", net), null);
  assert.equal(await lookupLinkIcon("10.0.0.1", net), null);
  assert.ok(!net.asked.some((url) => /localhost|10\.0\.0\.1/.test(url)));

  const served = /** @type {Response} */ (await linkIconResponse("/link-icons/a.example.png", net.store, { headers: UPLOAD_HEADERS }));
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("Content-Type"), "image/png");
  assert.match(String(served.headers.get("Cache-Control")), /immutable/);
  assert.equal((await linkIconResponse("/link-icons/a.example.svg", net.store, { headers: UPLOAD_HEADERS }))?.status, 404);
  assert.equal((await linkIconResponse("/link-icons/b.example.svg", net.store, { headers: UPLOAD_HEADERS }))?.status, 404);
  assert.equal(await linkIconResponse("/writing/a", net.store, { headers: UPLOAD_HEADERS }), null);
});
