import assert from "node:assert/strict";
import test from "node:test";
import { accessibilityStatement, HAND_CHECK_LIMITATIONS } from "../accessibility.mjs";

/** @type {import("../accessibility.d.mts").AccessibilityInput} */
const input = { siteName: "Example", contact: { href: "/contact", label: "the contact page" }, date: "2026-10-31", capsomer: true, links: "marked" };

test("a partial statement lists the site's findings and the hand-check gaps, with a plain date", () => {
  const { body, title } = accessibilityStatement({ ...input, limitations: ["The map has no text alternative."] });
  assert.equal(title, "Accessibility statement");
  assert.match(body, /partially conforms to WCAG 2\.2 level AA/);
  assert.match(body, /- The map has no text alternative\./);
  for (const item of HAND_CHECK_LIMITATIONS) assert.ok(body.includes(item));
  assert.match(body, /\[the contact page\]\(\/contact\)/);
  assert.match(body, /last reviewed on October 31, 2026\./);
});

test("a full statement with no findings says none are known; a bad date is refused", () => {
  assert.match(accessibilityStatement({ ...input, conformance: "full" }).body, /conforms to WCAG 2\.2 level AA\./);
  assert.match(accessibilityStatement({ ...input, conformance: "full" }).body, /no limitations/);
  assert.throws(() => accessibilityStatement({ ...input, date: "Oct 31" }), /YYYY-MM-DD/);
});

test("the HTML copy has the same sections and escapes what the site passes", () => {
  const { html } = accessibilityStatement({ ...input, siteName: "A & B", limitations: ["x < y"], contact: { href: "/c?a=1&b=2", label: "the <contact> page" } });
  assert.match(html, /<h2>Known limitations<\/h2><ul><li>x &lt; y<\/li>/);
  assert.match(html, /<a href="\/c\?a=1&amp;b=2">the &lt;contact&gt; page<\/a>/);
  assert.match(html, /A &amp; B partially conforms/);
  assert.ok(!html.includes("<contact>"));
});

test("the build sentences follow the site's setup, and a missing or impossible setup is refused", () => {
  const own = accessibilityStatement({ ...input, capsomer: false, links: "underline" }).body;
  assert.ok(!own.includes("Capsomer"));
  assert.match(own, /underlined as well as colored/);
  assert.ok(!own.includes("heavier weight"));
  assert.match(accessibilityStatement({ ...input, capsomer: false, links: "bold" }).body, /heavier weight than the words around it/);
  assert.match(accessibilityStatement(input).body, /We build every page from Capsomer[\s\S]*says when it leaves the site/);
  // @ts-expect-error a site that does not say how it is built is refused
  assert.throws(() => accessibilityStatement({ ...input, capsomer: undefined }), /capsomer must say/);
  // @ts-expect-error
  assert.throws(() => accessibilityStatement({ ...input, links: undefined }), /links must be one of/);
  assert.throws(() => accessibilityStatement({ ...input, capsomer: false, links: "marked" }), /needs capsomer: true/);
});
