import assert from "node:assert/strict";
import test from "node:test";
import { accessibilityStatement, HAND_CHECK_LIMITATIONS } from "../accessibility.mjs";

const input = { siteName: "Example", contact: { href: "/contact", label: "the contact page" }, date: "2026-10-31" };

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
