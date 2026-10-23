// Holds the package to the output the sites already publish. test/fixtures/ is each site's own output, captured by
// scripts/capture-site-helper-fixtures.mjs in dustinedwards-info (PROVENANCE.json names the commits), and the package must
// reproduce it byte for byte from the same data, so a change here shows up as a changed fixture.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RRF_K,
  cdata,
  escapeXml,
  fuse,
  ftsLiteral,
  llmsDocument,
  rfc822,
  sitemapDocument,
  toMatchExpression,
} from "../index.mjs";

const fixture = (/** @type {string} */ name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** The entries a sitemap lists, read back out of the captured document. */
function entriesOf(/** @type {string} */ xml, /** @type {RegExp} */ lastmodPattern) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body]) => {
    const get = (/** @type {string} */ tag) => body.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1];
    const lastmod = get("lastmod");
    const priority = get("priority");
    return {
      loc: /** @type {string} */ (get("loc")),
      lastmod: lastmod && lastmodPattern.test(lastmod) ? lastmod : null,
      changefreq: get("changefreq"),
      priority: priority === undefined ? undefined : Number(priority),
    };
  });
}

test("sitemap: this site's document is reproduced byte for byte", () => {
  const xml = fixture("dustinedwards-sitemap.xml");
  assert.equal(sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}$/)), xml);
});

test("sitemap: germomics' compact document with no trailing newline is reproduced byte for byte", () => {
  const xml = fixture("germomics-sitemap.xml");
  assert.equal(sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}$/), { trailingNewline: false }), xml);
});

test("sitemap: foxhound's expanded document with datetimes, changefreq and priority is reproduced byte for byte", () => {
  const xml = fixture("foxhound-sitemap.xml");
  assert.equal(
    sitemapDocument(entriesOf(xml, /^\d{4}-\d{2}-\d{2}T/), { layout: "expanded", lastmodFormat: "datetime" }),
    xml,
  );
});

test("sitemap: a loc with an ampersand does not end the document", () => {
  const xml = sitemapDocument([{ loc: "https://x.test/a?b=1&c=2" }]);
  assert.match(xml, /<loc>https:\/\/x\.test\/a\?b=1&amp;c=2<\/loc>/);
});

test("sitemap: images are listed under their page, and the image namespace is declared only when one is", () => {
  const compact = sitemapDocument([
    { loc: "https://x.test/a", lastmod: "2026-10-01", images: ["https://x.test/a.png", "https://x.test/b.jpg?w=1&h=2"] },
    { loc: "https://x.test/b" },
  ]);
  assert.match(compact, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9" xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1">/);
  assert.match(
    compact,
    /<url><loc>https:\/\/x\.test\/a<\/loc><lastmod>2026-10-01<\/lastmod><image:image><image:loc>https:\/\/x\.test\/a\.png<\/image:loc><\/image:image><image:image><image:loc>https:\/\/x\.test\/b\.jpg\?w=1&amp;h=2<\/image:loc><\/image:image><\/url>/,
  );
  assert.match(compact, /<url><loc>https:\/\/x\.test\/b<\/loc><\/url>/);

  const expanded = sitemapDocument([{ loc: "https://x.test/a", images: ["https://x.test/a.png"] }], { layout: "expanded" });
  assert.match(expanded, /\n    <image:image><image:loc>https:\/\/x\.test\/a\.png<\/image:loc><\/image:image>\n  <\/url>/);

  assert.doesNotMatch(sitemapDocument([{ loc: "https://x.test/a", images: [] }]), /xmlns:image|image:image/);
});

/** The sections of a captured llms.txt, parsed back so the skeleton can be rebuilt from them. */
function llmsParts(/** @type {string} */ text) {
  const [head, ...sectionTexts] = text.split(/\n## /);
  const [title, summary, ...intro] = head.trimEnd().split("\n\n");
  return {
    title: title.replace(/^# /, ""),
    summary: summary.replace(/^> /, ""),
    intro,
    sections: sectionTexts.map((section) => {
      const [heading, ...lines] = section.trimEnd().split("\n");
      return {
        heading,
        links: lines.map((line) => {
          const match = line.match(/^- \[(.*)\]\((\S+)\)(?:: (.*))?$/);
          assert.ok(match, `a link line: ${line}`);
          return { title: match[1], url: match[2], description: match[3] };
        }),
      };
    }),
  };
}

test("llms: germomics' file is reproduced byte for byte from its parts", () => {
  const text = fixture("germomics-llms.txt");
  assert.equal(llmsDocument(llmsParts(text)), text);
});

test("llms: a link title's brackets are escaped and an empty section is dropped", () => {
  const text = llmsDocument({
    title: "T",
    summary: "S",
    sections: [
      { heading: "A", links: [{ title: "[draft] note", url: "https://x.test/n" }] },
      { heading: "Empty", links: [] },
    ],
  });
  assert.match(text, /- \[\\\[draft\\\] note\]\(https:\/\/x\.test\/n\)/);
  assert.doesNotMatch(text, /## Empty/);
});

test("xml: the sites' feed fragments are the primitives' output", () => {
  const germomics = fixture("germomics-site-feed.xml");
  assert.ok(germomics.includes(`<title>${escapeXml(`Why phages win: notes & "questions" <draft>`)}</title>`));
  assert.ok(germomics.includes(`<pubDate>${rfc822("2026-06-21 09:30:00")}</pubDate>`));
  assert.ok(germomics.includes(`<pubDate>${rfc822("2026-05-02T08:00:00Z")}</pubDate>`));
  const foxhound = fixture("foxhound-feed.rss");
  assert.ok(foxhound.includes(`<title>${cdata(`Recovering failed payments: what works & what "doesn't"`)}</title>`));
  assert.ok(foxhound.includes(`<pubDate>${rfc822(new Date("2026-08-01T12:00:00.000Z"))}</pubDate>`));
});

test("search: a quote inside a term is doubled, so the term cannot leave its quotes", () => {
  assert.equal(ftsLiteral(`say "hi"`), `"say ""hi"""`);
  assert.equal(toMatchExpression({ terms: [`a"b`] }), `"a""b"`);
});

test("search: operators and hyphens stay literal text", () => {
  assert.equal(toMatchExpression({ terms: ["NEAR", "t-cell"], phrases: ["exact words"] }), `"exact words" AND "NEAR" AND "t-cell"`);
});

test("search: only the last term takes the prefix star, and nothing to match is null", () => {
  assert.equal(toMatchExpression({ terms: ["a", "cloudf"] }, true), `"a" AND "cloudf"*`);
  assert.equal(toMatchExpression({ terms: [] }), null);
});

test("search: fusion uses k = 60 and adds a document's contributions from every list", () => {
  assert.equal(RRF_K, 60);
  const [top] = fuse([[{ uid: "a" }, { uid: "b" }], [{ uid: "b" }]]);
  assert.equal(top.item.uid, "b");
  assert.equal(top.score, 1 / (60 + 2) + 1 / (60 + 1));
  assert.deepEqual(top.ranks, [2, 1]);
});

test("search: the fusion constant is the argument's, not a baked-in one", () => {
  const [only] = fuse([[{ uid: "a" }]], 10);
  assert.equal(only.score, 1 / 11);
});
