// The edges of the XML helpers that the byte-for-byte fixtures do not reach: dates from every form a site stores, on a
// machine in any time zone; absolute URLs left as they are; and KaTeX in the places it actually turns up in a post.

import assert from "node:assert/strict";
import test from "node:test";

import {
  absolutizeUrls,
  jsonLdText,
  atomEntry,
  cdata,
  escapeXml,
  escapeXmlText,
  isoDay,
  mathToTex,
  rfc822,
  rssItem,
  sitemapDocument,
} from "../index.mjs";

/** Runs `body` with the process in another time zone, so a date read as local time shows up as wrong. */
function inZone(/** @type {string} */ zone, /** @type {() => void} */ body) {
  const saved = process.env.TZ;
  process.env.TZ = zone;
  try {
    body();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

/** One KaTeX expression as KaTeX renders it, inline or display, with `tex` as its annotation. */
function katex(/** @type {string} */ tex, display = false) {
  const inner = `<span class="katex"><span class="katex-mathml"><math><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="mord">x</span></span></span></span>`;
  return display ? `<span class="katex-display">${inner}</span>` : inner;
}

test("xml: escaping leaves plain text, empty text and non-strings readable", () => {
  assert.equal(escapeXml(""), "");
  assert.equal(escapeXml("plain text"), "plain text");
  assert.equal(escapeXml(42), "42");
  assert.equal(escapeXmlText(null), "null");
  const long = `<&>"'`.repeat(10000);
  assert.equal(escapeXml(long), "&lt;&amp;&gt;&quot;&apos;".repeat(10000));
  assert.equal(escapeXmlText(long), `&lt;&amp;&gt;"'`.repeat(10000));
});

test("xml: CDATA wraps empty text, and every ]]> in long text, so the text reads back whole", () => {
  assert.equal(cdata(""), "<![CDATA[]]>");
  const text = "a]]>b]]]>c".repeat(1000);
  const wrapped = cdata(text);
  const sections = [...wrapped.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]);
  assert.equal(sections.join(""), text);
  assert.equal(wrapped.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ""), "");
});

test("xml: dates from a Date, an epoch and both stored string forms are the same instant", () => {
  const expected = "Sun, 21 Jun 2026 09:30:00 GMT";
  assert.equal(rfc822(new Date("2026-06-21T09:30:00Z")), expected);
  assert.equal(rfc822(Date.UTC(2026, 5, 21, 9, 30)), expected);
  assert.equal(rfc822("2026-06-21T09:30:00Z"), expected);
  assert.equal(rfc822("2026-06-21 09:30:00"), expected);
  assert.equal(isoDay(Date.UTC(2026, 5, 21, 23, 59)), "2026-06-21");
  assert.equal(isoDay(new Date("2026-06-21T23:59:00Z")), "2026-06-21");
});

test("xml: a stored date reads as UTC whatever zone the machine is in", () => {
  inZone("America/Chicago", () => {
    assert.equal(rfc822("2026-06-21 09:30:00"), "Sun, 21 Jun 2026 09:30:00 GMT");
    assert.equal(isoDay("2026-06-21 23:30:00"), "2026-06-21");
  });
  inZone("Asia/Tokyo", () => {
    assert.equal(rfc822("2026-06-21 09:30:00"), "Sun, 21 Jun 2026 09:30:00 GMT");
    assert.equal(isoDay("2026-06-21 00:30:00"), "2026-06-21");
  });
});

test("xml: feeds and a datetime sitemap read a stored date as UTC whatever zone the machine is in", () => {
  const post = {
    slug: "a",
    title: "A",
    html: "",
    description: null,
    publishAt: "2026-06-21 09:30:00",
    updatedAt: null,
    tags: /** @type {string[]} */ ([]),
  };
  inZone("America/Chicago", () => {
    assert.match(rssItem(post, "https://x.test"), /<pubDate>Sun, 21 Jun 2026 09:30:00 GMT<\/pubDate>/);
    assert.match(atomEntry(post, "https://x.test"), /<published>2026-06-21T09:30:00.000Z<\/published>/);
    const sitemap = sitemapDocument([{ loc: "https://x.test/a", lastmod: "2026-06-21 09:30:00" }], {
      lastmodFormat: "datetime",
    });
    assert.match(sitemap, /<lastmod>2026-06-21T09:30:00.000Z<\/lastmod>/);
  });
});

test("xml: a missing or invalid date is the epoch in a feed and nothing in a sitemap", () => {
  const epoch = "Thu, 01 Jan 1970 00:00:00 GMT";
  assert.equal(rfc822(null), epoch);
  assert.equal(rfc822(undefined), epoch);
  assert.equal(rfc822(""), epoch);
  assert.equal(rfc822(new Date("nope")), epoch);
  assert.equal(isoDay(undefined), null);
  assert.equal(isoDay(""), null);
  assert.equal(isoDay(new Date("nope")), null);
});

test("xml: absolute and protocol-relative URLs in a srcset are left alone", () => {
  const html = `<img srcset="https://cdn.test/a.png 1x, //cdn.test/b.png 2x, /c.png 3x">`;
  assert.equal(
    absolutizeUrls(html, "https://x.test"),
    `<img srcset="https://cdn.test/a.png 1x, //cdn.test/b.png 2x, https://x.test/c.png 3x">`,
  );
});

test("xml: absolute links and document-relative links are left alone", () => {
  const html = `<a href="https://y.test/a">a</a><a href="b/c">b</a><img src="http://y.test/i.png">`;
  assert.equal(absolutizeUrls(html, "https://x.test"), html);
  assert.equal(absolutizeUrls("", "https://x.test"), "");
});

test("xml: text around KaTeX is kept, and each expression keeps its own TeX", () => {
  const html = `<p>Let ${katex("a + b")} and ${katex("c^2")} hold.</p>`;
  assert.equal(mathToTex(html), "<p>Let $a + b$ and $c^2$ hold.</p>");
});

test("xml: display math becomes $$, with no wrapper left behind", () => {
  assert.equal(mathToTex(`<p>${katex("x = 1", true)}</p>`), "<p>$$x = 1$$</p>");
});

test("xml: inline math before display math is converted too, each with its own delimiter", () => {
  const html = ` ${katex("a")} then ${katex("b", true)} then ${katex("c")}`;
  assert.equal(mathToTex(html), " $a$ then $$b$$ then $c$");
});

test("xml: the TeX is trimmed and keeps its own escaping", () => {
  assert.equal(mathToTex(katex("  a &lt; b\n")), "$a &lt; b$");
});

test("xml: KaTeX with no annotation, an empty one or no closing tag is left as it was", () => {
  const noAnnotation = `<p>${`<span class="katex"><span class="katex-html">x</span></span>`}</p>`;
  assert.equal(mathToTex(noAnnotation), noAnnotation);
  const empty = `<p>${katex("")}</p>`;
  assert.equal(mathToTex(empty), empty);
  const unclosed = `<p>Unclosed: <span class="katex"><span><annotation encoding="application/x-tex">x</annotation></span> and on</p>`;
  assert.equal(mathToTex(unclosed), unclosed);
  const unclosedAtEnd = `ab<span class="katex"><span><annotation encoding="application/x-tex">x</annotation></span>`;
  assert.equal(mathToTex(unclosedAtEnd), unclosedAtEnd);
  const followed = `${noAnnotation}${katex("y")}`;
  assert.equal(mathToTex(followed), `${noAnnotation}$y$`);
});

test("xml: HTML with no math, or no HTML at all, comes back unchanged", () => {
  assert.equal(mathToTex(""), "");
  assert.equal(mathToTex("<p>no <span>math</span> here</p>"), "<p>no <span>math</span> here</p>");
});

test("jsonLdText cannot end its script element, and parses back to the same data", () => {
  const value = { name: `</script><b>&${String.fromCharCode(0x2028)}` };
  const text = jsonLdText(value);
  assert.doesNotMatch(text, new RegExp(`[<>&${String.fromCharCode(0x2028)}]`));
  assert.deepEqual(JSON.parse(text), value);
});
