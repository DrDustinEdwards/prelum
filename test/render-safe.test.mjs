// The safe-HTML guarantee of the markdown pipeline: the hostile corpus renders to nothing a browser could run, the scan that says so is
// itself seen to catch each class of attack, and the allowlist it holds the output to is derived from real output rather than written.
//
// UPDATE_ALLOWLIST=1 npm test rewrites render-allowlist.mjs from the benign corpus. Review the diff: a new tag or attribute there is a
// change in what the pipeline can emit.

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";

import { DEFAULT_ALLOWLIST } from "../render-allowlist.mjs";
import { HOSTILE_INPUTS, runConformance } from "../render-conformance.mjs";
import { ContentError, render } from "../render.mjs";
import { assertSafe, inventory, scanHtml } from "../render-safe.mjs";
import { FIXTURES, fixture, resolveImage, siteOptions } from "./render-config.mjs";

/** @param {string} body */
const renderSite = (body) => render({ file: "test.md", body, resolveImage, options: siteOptions });

/** @param {string} html */
const kinds = (html) => scanHtml(html).violations.map((v) => v.kind);

test("the hostile corpus renders nothing unsafe, and says how much it read", async () => {
  const result = await runConformance(renderSite);

  assert.equal(result.inputs, HOSTILE_INPUTS.length);
  assert.equal(result.rendered + result.refused.length, result.inputs, "every input either rendered or was refused");
  assert.deepEqual(result.violations, []);
  // Zero violations must not mean zero read: most inputs render, and the scan walked real elements and attributes.
  assert.ok(result.rendered >= 36, `only ${result.rendered} of ${result.inputs} rendered`);
  assert.ok(result.elements > 100, `only ${result.elements} elements scanned`);
  assert.ok(result.attributes > 50, `only ${result.attributes} attributes scanned`);
});

test("a renderer that crashes is a failure of the check, not a refusal", async () => {
  await assert.rejects(
    runConformance(async () => {
      throw new TypeError("missing peer dependency");
    }),
    TypeError,
  );
  const refusing = await runConformance(async () => {
    throw new ContentError("x.md", "refused");
  });
  assert.equal(refusing.refused.length, HOSTILE_INPUTS.length);
  assert.equal(refusing.rendered, 0);
});

test("the corpus is large enough to cover the classes it names", () => {
  assert.ok(HOSTILE_INPUTS.length >= 44);
  assert.equal(new Set(HOSTILE_INPUTS.map((input) => input.name)).size, HOSTILE_INPUTS.length, "names are unique");
  for (const word of ["script", "onerror", "iframe", "svg", "form", "vbscript", "file", "katex", "directive", "comment", "bracket"]) {
    assert.ok(HOSTILE_INPUTS.some((input) => input.name.includes(word)), `no input for ${word}`);
  }
});

test("the construction holds: raw HTML in the source never becomes markup", async () => {
  const { html } = await renderSite('<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<!-- c -->');
  assert.doesNotMatch(html, /<script|<img|<!--/);
});

test("the construction holds: a link outside https, http, mailto or relative is shown as text and reported", async () => {
  const link = await renderSite("[x](javascript:alert(1))");
  assert.doesNotMatch(link.html, /<a /);
  assert.match(link.html, /\[x\]\(javascript:alert\(1\)\)/);
  assert.deepEqual(link.blockedUrls.map(({ tag, url }) => ({ tag, url })), [{ tag: "a", url: "javascript:alert(1)" }]);

  // No wrapper link is made for a blocked image, and the site's resolver is never asked about it.
  /** @type {string[]} */
  const asked = [];
  const image = await render({
    file: "test.md",
    body: "![y](data:image/png;base64,AAAA)",
    resolveImage: async (src) => {
      asked.push(src);
      throw new Error("a resolver that cannot read this");
    },
    options: siteOptions,
  });
  assert.doesNotMatch(image.html, /<a |<img/);
  assert.match(image.html, /!\[y\]\(data:image\/png;base64,AAAA\)/);
  assert.deepEqual(image.blockedUrls.map(({ tag, url }) => ({ tag, url })), [{ tag: "img", url: "data:image/png;base64,AAAA" }]);
  assert.deepEqual(asked, []);
});

test("the construction holds: KaTeX does not turn \\href or \\url into a link", async () => {
  for (const source of ["$\\href{javascript:alert(1)}{x}$", "$\\url{javascript:alert(1)}$", "$\\href{https://example.com}{x}$"]) {
    const rendered = await renderSite(source).then(
      ({ html }) => html,
      (error) => error,
    );
    // Refused, or rendered with no anchor: both are safe, a link is not.
    assert.ok(typeof rendered !== "string" || !/<a[ >]/.test(rendered), source);
  }
});

test("the scan catches each class of attack it exists to catch", () => {
  assert.deepEqual(kinds("<script>alert(1)</script>"), ["element"]);
  assert.deepEqual(kinds("<iframe src='https://example.com'></iframe>"), ["element", "attribute"]);
  assert.deepEqual(kinds("<p onclick='x()'>t</p>"), ["event-handler"]);
  assert.deepEqual(kinds("<img src='x' onerror='alert(1)'>"), ["event-handler"]);
  assert.deepEqual(kinds("<a href='javascript:alert(1)'>t</a>"), ["url"]);
  assert.deepEqual(kinds("<a href='JaVa&#9;Script:alert(1)'>t</a>"), ["url"]);
  assert.deepEqual(kinds("<a href='data:text/html,x'>t</a>"), ["url"]);
  assert.deepEqual(kinds("<img src='/a.png' alt='' srcset='/a.png 1x, javascript:alert(1) 2x'>"), ["url"]);
  assert.deepEqual(kinds("<img src='/a.png' alt='' srcset='/a.png 640w, /a.png?w=1024 1024w'>"), []);
  assert.deepEqual(kinds("<p><!-- c --></p>"), ["comment"]);
  assert.deepEqual(kinds("<svg onload='alert(1)'></svg>"), ["event-handler"]);
  assert.deepEqual(kinds("<span style='background:url(https://example.com/x)'>t</span>"), ["style"]);
  assert.deepEqual(kinds("<span style='background:u\\72l(https://example.com/x)'>t</span>"), ["style"]);
  assert.deepEqual(kinds("<span style='width:expression(alert(1))'>t</span>"), ["style"]);
  assert.deepEqual(kinds("<p class='a' unknown-attribute='1'>t</p>"), ["attribute"]);
});

test("the scan reads with a parser: attribute-looking text inside a value is not an attribute", () => {
  const scan = scanHtml('<p class="onerror=alert(1)">onerror=alert(1) &lt;script&gt;</p>');
  assert.deepEqual(scan.violations, []);
  assert.equal(scan.elements, 1);
  assert.equal(scan.attributes, 1);
});

test("the one style that may carry a url() is the pipeline's own image placeholder", () => {
  const placeholder = 'background-image:url("data:image/webp;base64,UklGRhoAAABXRUJQ")';
  assert.deepEqual(kinds(`<img src="/a.png" alt="" class="has-lqip" style='${placeholder}'>`), []);
  assert.deepEqual(kinds(`<img src="/a.png" alt="" class="has-lqip" style='background-image:url("https://example.com/x.png")'>`), ["style"]);
  assert.deepEqual(kinds(`<img src="/a.png" alt="" class="has-lqip" style='${placeholder};background:url(x)'>`), ["style"]);
});

test("assertSafe throws a ContentError that names what it found, and passes safe output", () => {
  assert.doesNotThrow(() => assertSafe("<p>fine <em>text</em></p>"));
  assert.throws(
    () => assertSafe("<p>x</p><script>alert(1)</script>"),
    (error) => error instanceof ContentError && /unsafe output refused: 1 violation: element script/.test(error.message),
  );
});

test("render with assertSafe refuses a write the allowlist cannot vouch for", async () => {
  const source = "plain text";
  const empty = { tags: new Set(), attributes: new Set() };
  const options = { ...siteOptions, assertSafe: empty };
  await assert.rejects(
    render({ file: "test.md", body: source, resolveImage, options }),
    (error) => error instanceof ContentError && /unsafe output refused/.test(error.message),
  );
  const ok = await render({ file: "test.md", body: source, resolveImage, options: { ...siteOptions, assertSafe: true } });
  assert.equal(ok.html, "<p>plain text</p>");
});

test("every fixture passes the scan under its own allowlist", async () => {
  for (const name of FIXTURES) {
    const options = { ...siteOptions, assertSafe: true };
    await render({ file: name, body: fixture(name), resolveImage, options });
  }
});

test("the allowlist is derived from the corpus output, and fails both ways", async () => {
  /** @type {string[]} */
  const outputs = [];
  for (const name of FIXTURES) {
    outputs.push((await render({ file: name, body: fixture(name), resolveImage, options: siteOptions })).html);
  }
  const derived = inventory(outputs);

  if (process.env.UPDATE_ALLOWLIST === "1") {
    const lines = (/** @type {string[]} */ list) => list.map((item) => `    ${JSON.stringify(item)},`).join("\n");
    writeFileSync(
      new URL("../render-allowlist.mjs", import.meta.url),
      "// GENERATED by test/render-safe.test.mjs from the benign corpus (UPDATE_ALLOWLIST=1 npm test). Do not edit by hand.\n" +
        `export const DEFAULT_ALLOWLIST = {\n  tags: new Set([\n${lines(derived.tags)}\n  ]),\n  attributes: new Set([\n${lines(derived.attributes)}\n  ]),\n};\n`,
    );
    return;
  }

  const tags = [...DEFAULT_ALLOWLIST.tags].sort();
  const attributes = [...DEFAULT_ALLOWLIST.attributes].sort();
  assert.deepEqual(
    derived.tags.filter((tag) => !tags.includes(tag)),
    [],
    "tags in the output that are not in the allowlist",
  );
  assert.deepEqual(
    tags.filter((tag) => !derived.tags.includes(tag)),
    [],
    "tags in the allowlist that never appear in the output",
  );
  assert.deepEqual(
    derived.attributes.filter((pair) => !attributes.includes(pair)),
    [],
    "tag-attribute pairs in the output that are not in the allowlist",
  );
  assert.deepEqual(
    attributes.filter((pair) => !derived.attributes.includes(pair)),
    [],
    "tag-attribute pairs in the allowlist that never appear in the output",
  );
  assert.ok(tags.length > 40, `only ${tags.length} tags in the allowlist`);
  assert.ok(attributes.length > 80, `only ${attributes.length} pairs in the allowlist`);
});
