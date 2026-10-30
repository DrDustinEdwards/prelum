// The live check for writing, on one page holding every defect it names and one holding none.

import assert from "node:assert/strict";
import test from "node:test";

import { RENDER_VERSION } from "../render-nomath.mjs";
import { auditContent } from "../render-audit.mjs";

test("the writing check finds each defect it names, and nothing on a clean page", () => {
  const bad = `<h2 id="a">A</h2><h4 id="a">B</h4><a href="#missing">x</a><img src="/x.png"><p>Text :::callout and [!NOTE] and ::postlink[x]</p>
<div data-render-version="1"><h3 class="z"><a class="heading-anchor" href="#a">#</a></h3></div>`;
  const good = `<h1 id="t">T</h1><div data-render-version="${RENDER_VERSION}"><h2 id="s">S<a class="heading-anchor" href="#s">#</a></h2>
<p>Prose 12:30 and a <code>:::figure</code> example.</p><img src="/y.png" alt="" width="1" height="1"></div>`;
  const findings = auditContent([
    { url: "https://example.com/bad", status: 200, html: bad },
    { url: "https://example.com/good", status: 200, html: good },
  ]);
  assert.deepEqual(findings.filter((f) => f.url.endsWith("/good")), []);
  assert.deepEqual([...new Set(findings.map((f) => f.check))].sort(), [
    "writing-duplicate-id",
    "writing-fragment",
    "writing-h1",
    "writing-heading-order",
    "writing-img-alt",
    "writing-img-size",
    "writing-leak",
    "writing-render-version",
  ]);
  assert.equal(findings.filter((f) => f.check === "writing-leak").length, 3);
});
