// The markdown pipeline's behavior: what it returns, what it refuses and says why, and that the parts a site injects (media, packs,
// highlighting) are the only parts that know about the site.

import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, RENDER_VERSION, ContentError, render } from "../render.mjs";
import { htmlHasMath } from "../render-math.mjs";
import { render as renderNoMath } from "../render-nomath.mjs";
import { isAllowedUrl } from "../render-url.mjs";
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
    "hasMath",
    "html",
    "mediaRefs",
    "renderVersion",
    "toc",
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
  assert.match(html, /<h1 id="a-title">/);
  assert.match(html, /<div class="table-scroll" tabindex="0"><table>/);
  assert.match(html, /<img src="\/media\/dustin-edwards-sample-0123456789abcdef-640x480.png"/);
  assert.doesNotMatch(html, /srcset=/);
  assert.deepEqual(mediaRefs, []);
});

test("headings get an id, a keyboard-reachable anchor named for the heading, and an outline entry; footnotes do not", async () => {
  const { html, toc } = await core("## Methods & `code`\n\ntext[^1]\n\n[^1]: note");
  assert.match(html, /<h2 id="methods--code">Methods &#x26; <code>code<\/code><a class="heading-anchor" aria-label="Link to section: Methods &#x26; code" href="#methods--code">#<\/a><\/h2>/);
  assert.deepEqual(toc, [{ depth: 2, id: "methods--code", text: "Methods & code" }]);
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

  await refuses(core("one\n\n:::figrue{src=\"/a.png\" alt=\"x\"}\n:::"), /unknown directive ":::figrue" on line 3\. Known directives: details, figure\./);
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
  const body = "![one](/media/dustin-edwards-a-0123456789abcdef-640x480.png)\n\n![two](/static/b.png)\n\n![three](/media/dustin-edwards-c-fedcba9876543210-100x100.png)";
  const { html, mediaRefs } = await core(body, { media });

  assert.match(html, /<a class="image-link" href="\/media\/dustin-edwards-a-0123456789abcdef-640x480\.png"><img src="[^"]+" alt="one" srcset="\/media\/[^"]+\?w=640 640w, [^"]+ 1024w, [^"]+ 1408w" sizes="\(min-width: 46rem\) 704px, calc\(100vw - 2rem\)" width="640" height="480" loading="eager" decoding="async" fetchpriority="high" class="has-lqip" style="background-image:url\(&#x22;data:image\/webp;base64,/);
  // Not a media image: no srcset, no placeholder, and the link goes to the image itself.
  assert.match(html, /<a class="image-link" href="\/static\/b\.png"><img src="\/static\/b\.png" alt="two" width="800" height="600" loading="lazy" decoding="async"><\/a>/);
  assert.equal((html.match(/fetchpriority/g) ?? []).length, 1);
  assert.deepEqual(
    mediaRefs.map(({ key, form, detail }) => ({ key, form, detail })),
    [
      { key: "dustin-edwards-a-0123456789abcdef-640x480.png", form: "markdown-image", detail: "line 1" },
      { key: "dustin-edwards-c-fedcba9876543210-100x100.png", form: "markdown-image", detail: "line 5" },
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
  });
});

test("code is plain without a highlighter, and highlighted, labeled and line-marked with one", async () => {
  const plain = await core("```js\nlet a\n```");
  assert.equal(plain.html, '<pre><code class="language-js">let a\n</code></pre>');

  const { html } = await core(fixture("code"), { highlight });
  assert.match(html, /<pre class="shiki shiki-themes github-light-high-contrast github-dark-high-contrast" style="[^"]*" tabindex="0" data-lang="js">/);
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
  assert.match(result.html, /^<h1 id="real">/);
  assert.equal(result.toc.length, 0);
  assert.equal(result.renderVersion, RENDER_VERSION);
  assert.equal(/** @type {any} */ (result).extra, 1);
});

test("the editorial pack: sidenotes, pull quotes, swatches, charts and diagrams, each refused with a reason when misused", async () => {
  const { html, diagrams } = await site(fixture("directives"));

  assert.match(html, /<aside class="post-note" id="sn-1"><b class="post-note-kind">Fallback<\/b>/);
  assert.match(html, /<p class="pull-quote" aria-hidden="true">sentence worth raising<\/p>/);
  assert.match(html, /<span class="swatch"><span class="swatch-chip" style="--swatch:#6B4FBB" aria-hidden="true"><\/span><code class="swatch-label">#6B4FBB<\/code><\/span>/);
  assert.match(html, /<span class="swatch-chip" style="--swatch:#FFF" aria-hidden="true"><\/span><code class="swatch-label">the brand<\/code>/);
  assert.equal((html.match(/<figure class="chart-figure enarratio"/g) ?? []).length, 2);
  assert.match(html, /src="\/diagrams\/dustin-edwards-4efabcc1-light\.svg"/);
  assert.match(html, /src="\/diagrams\/dustin-edwards-4efabcc1-dark\.svg"/);
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
  await refuses(site(':::diagram{alt="x"}\n```text\nA\n```\n:::'), /source must be a ```mermaid fenced block, found ```text/);
  await refuses(site(':::diagram{title="T"}\n```mermaid\nA-->B\n```\n:::'), /:::diagram "T" requires an alt attribute/);
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
