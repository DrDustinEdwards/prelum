// Inputs the byte-for-byte fixtures do not reach: forbidden XML characters, quoted `>` in attributes, IndexNow limits,
// zone-less dates, inline tags, frontmatter YAML corners and the validated sitemap fields.

import assert from "node:assert/strict";
import test from "node:test";

import { auditPages } from "../audit.mjs";
import { feedItem } from "../feeds.mjs";
import { frontmatter } from "../frontmatter.mjs";
import { absoluteUrl } from "../head.mjs";
import { recentSitemapUrls, submitIndexNow } from "../indexnow.mjs";
import { llmsDocument, llmsLink } from "../llms.mjs";
import { htmlToMarkdown, llmsHeaderOf } from "../markdown-copy.mjs";
import { toMatchExpression } from "../search.mjs";
import { sitemapDocument } from "../sitemap.mjs";
import { isSlug, slugify } from "../slug.mjs";
import { htmlToText, humanize, isoDuration, normalizeHex, titleCase } from "../text.mjs";
import { absolutizeUrls, cdata, escapeXml, isoDay, rfc822, unescapeXml } from "../xml.mjs";

test("xml: characters XML 1.0 forbids are dropped, tab, newline and astral characters kept", () => {
  assert.equal(escapeXml("a\u0000b\u0008c\u000bd\u001fe￿￿"), "abcde");
  assert.equal(cdata("a\u000cb"), "<![CDATA[ab]]>");
  assert.equal(escapeXml("a\tb\nc😀"), "a\tb\nc😀");
});

test("xml: a zone-less time is UTC in any zone, and an offset without a T is honored", () => {
  const saved = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.equal(rfc822("2026-06-21T09:30:00"), "Sun, 21 Jun 2026 09:30:00 GMT");
    assert.equal(rfc822("2026-06-21 09:30:00+02:00"), "Sun, 21 Jun 2026 07:30:00 GMT");
    assert.equal(isoDay("2026-06-21 00:30:00+02:00"), "2026-06-20");
    assert.equal(isoDay("2026-06-21"), "2026-06-21");
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test("xml: absolutizeUrls reads single-quoted attributes and leaves escaped code samples alone", () => {
  assert.equal(
    absolutizeUrls(
      `<a href='/x'>&lt;a href="/y"&gt;</a><img src="/i.png" srcset='/i.png 1x, /j.png 2x'>`,
      "https://e.test",
    ),
    `<a href='https://e.test/x'>&lt;a href="/y"&gt;</a><img src="https://e.test/i.png" srcset='https://e.test/i.png 1x, https://e.test/j.png 2x'>`,
  );
  assert.equal(unescapeXml("a&amp;lt;&quot;&apos;&gt;"), `a&lt;"'>`);
  // Numeric references decode; one XML 1.0 forbids, or an unfinished one, stays as written.
  assert.equal(
    unescapeXml("&#38;&#x26;&#x1F600;&#0;&#xD800;&#x110000;&#38"),
    "&&\u{1F600}&#0;&#xD800;&#x110000;&#38",
  );
});

test("audit: a > inside a quoted attribute does not end the tag", () => {
  const description = `Fish > chips${"x".repeat(300)}`;
  const html = `<html lang="en"><head><title>T</title><meta name="description" content="${description}"></head><body></body></html>`;
  const { findings } = auditPages([{ url: "https://e.test/", status: 200, html }], {
    origin: "https://e.test",
  });
  assert.match(
    findings.find((f) => f.check === "description-long")?.detail ?? "",
    /\(312 characters\)/,
  );
});

test("indexnow: 10,000 URLs a POST, a trailing-slash origin works, all five entities decode", async () => {
  /** @type {number[]} */
  const sizes = [];
  const fetcher = /** @type {typeof fetch} */ (
    async (_url, init) => {
      sizes.push(JSON.parse(String(init?.body)).urlList.length);
      return new Response("", { status: 200 });
    }
  );
  const urls = Array.from({ length: 10_001 }, (_, i) => `https://e.test/${i}`);
  assert.equal(
    await submitIndexNow({ origin: "https://e.test/", key: "k", urls, fetch: fetcher }),
    true,
  );
  assert.deepEqual(sizes, [10_000, 1]);
  assert.deepEqual(
    recentSitemapUrls(
      "<urlset><url><loc>https://e.test/?a=1&amp;b=&lt;&gt;&quot;&apos;</loc></url></urlset>",
    ),
    [`https://e.test/?a=1&b=<>"'`],
  );
});

test("markdown copy: blank lines in fenced code stay, a malformed canonical is ignored", () => {
  const page = htmlToMarkdown(
    `<html><head><title>T</title><link rel="canonical" href="http://[bad"></head><body><main><p>a</p><pre><code>x\n\n\n\ny</code></pre></main></body></html>`,
    { base: "https://e.test/p" },
  );
  assert.ok(page.markdown.includes("x\n\n\n\ny"));
  assert.equal(page.canonical, undefined);
});

test("text: inline tags add no space, block tags do; a sub-second duration is none", () => {
  assert.equal(
    htmlToText("<p>Hello <b>world</b>.</p><p>Next<br>line</p>"),
    "Hello world. Next line",
  );
  assert.equal(isoDuration(0.4), undefined);
});

test("search: a punctuation-only term is dropped and NUL is stripped", () => {
  assert.equal(toMatchExpression({ terms: ["...", "a\u0000b"] }), '"ab"');
  assert.equal(toMatchExpression({ terms: ["--"] }), null);
});

test("frontmatter: empty header, BOM, quoted commas in a flow list and trailing comments", () => {
  assert.deepEqual(frontmatter("---\n---\nbody"), { data: {}, body: "body" });
  assert.deepEqual(frontmatter("﻿---\ntitle: x\n---\nbody").data, { title: "x" });
  assert.deepEqual(
    frontmatter(`---\ntags: ["a, b", c]\ndraft: true # wip\nt: "a # b" # c\n---\n`).data,
    { tags: ["a, b", "c"], draft: "true", t: "a # b" },
  );
});

test("llms: no summary writes no empty quote and no repeated title; newlines flatten; spaces and parentheses encode", () => {
  const header = llmsHeaderOf("# Site\n\nIntro\n\n## Docs\n", "https://e.test");
  assert.deepEqual(header, { title: "Site", summary: "", intro: ["Intro"] });
  assert.equal(llmsDocument({ ...header, sections: [] }), "# Site\n\nIntro\n");
  assert.equal(llmsDocument({ title: "A\nB", summary: "C\nD", sections: [] }), "# A B\n\n> C D\n");
  assert.equal(
    llmsLink({ title: "t", url: "https://e.test/a b_(c)" }),
    "- [t](https://e.test/a%20b_%28c%29)",
  );
});

test("feeds: the JSON Feed id is the guid when given", () => {
  const post = {
    slug: "s",
    title: "T",
    body: "b",
    description: null,
    publishAt: null,
    updatedAt: null,
    coverImage: null,
    tags: [],
  };
  assert.equal(feedItem({ ...post, guid: "urn:x:1" }, "https://e.test").id, "urn:x:1");
  assert.equal(feedItem(post, "https://e.test").id, "https://e.test/writing/s");
});

test("slug: a cut ends on a whole word; ß ø æ œ đ ł transliterate", () => {
  assert.equal(slugify("Straße Ørsted"), "strasse-orsted");
  assert.equal(slugify("Æon œuvre Đorđe Łódź"), "aeon-oeuvre-dorde-lodz");
  assert.equal(slugify("alpha beta gamma", { max: 8 }), "alpha");
  assert.equal(slugify("alpha beta gamma", { max: 10 }), "alpha-beta");
});

test("sitemap: priority and changefreq are validated, images are capped at 1,000", () => {
  const loc = "https://e.test/a";
  assert.throws(
    () => sitemapDocument([{ loc, priority: 1.5 }], { layout: "expanded" }),
    /priority/,
  );
  assert.throws(
    () => sitemapDocument([{ loc, priority: 0.25 }], { layout: "expanded" }),
    /steps of 0.1/,
  );
  assert.match(sitemapDocument([{ loc, priority: 0.3 }], { layout: "expanded" }), /<priority>0.3</);
  assert.throws(
    () => sitemapDocument([{ loc, changefreq: "sometimes" }], { layout: "expanded" }),
    /changefreq/,
  );
  const images = Array.from({ length: 1001 }, (_, i) => `https://e.test/${i}.png`);
  const xml = sitemapDocument([{ loc, images }]);
  assert.equal(xml.match(/<image:image>/g)?.length, 1000);
});

test("head: a protocol-relative URL becomes https", () => {
  assert.equal(absoluteUrl("https://e.test", "//cdn.x/i.png"), "https://cdn.x/i.png");
});

test("isSlug holds what slugify makes and refuses the rest", () => {
  for (const text of ["Café au lait", "Straße Ørsted", "  2026: Spring update!  "])
    assert.equal(isSlug(slugify(text)), true);
  for (const bad of ["", "-lead", "trail-", "two--hyphens", "Upper", "under_score", 7, null])
    assert.equal(isSlug(bad), false);
  assert.equal(isSlug("field-notes", { max: 5 }), false);
});

test("text: titleCase and humanize treat runs of _, - and spaces as one break and drop empty words", () => {
  assert.equal(titleCase("payment-recovery"), "Payment Recovery");
  assert.equal(normalizeHex(" #A1B "), "#aa11bb");
  assert.equal(titleCase("retry__card_declined"), "Retry Card Declined");
  assert.equal(titleCase("-"), "");
  assert.equal(humanize(" insufficient_funds "), "Insufficient funds");
  assert.equal(humanize("_"), "");
});
