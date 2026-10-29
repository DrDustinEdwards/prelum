// The parts of the SEO helpers a mistake in would ship silently: a named robots group that drops the disallow list opens every
// private path to that crawler; an empty date tag claims a page has no date; `</script>` in a title would end the JSON-LD; and an
// audit that compares URLs by their exact spelling misses a broken link written with a trailing slash or a fragment, and
// one that lets a workers.dev canonical or a redirect chain through calls a site clean that search engines do not. A cut
// title that runs past the limit with its "...", or an entity the audit reads as extra characters, warns on every page.

import assert from "node:assert/strict";
import test from "node:test";

import { auditPages, crawlSite } from "../audit.mjs";
import { headHtml, headTags, SERP_TITLE_LIMIT, searchTitle, truncateForSerp } from "../head.mjs";
import { aiTxt, DENIED_BOTS, robotsDocument } from "../robots.mjs";
import { article, jsonLd } from "../schema.mjs";

const ORIGIN = "https://example.com";

test("every named robots group carries the whole disallow list, and a denied bot gets Disallow: /", () => {
  const disallow = ["/admin", "/preview/"];
  const groups = robotsDocument({ origin: ORIGIN, disallow }).split("\n\n");
  const allowGroups = groups.filter((group) => group.includes("Allow: /\n") || group.endsWith("Allow: /"));
  assert.ok(allowGroups.length > 1);
  for (const group of allowGroups) {
    for (const path of disallow) assert.ok(group.includes(`Disallow: ${path}`), group);
  }
  for (const bot of DENIED_BOTS) {
    assert.ok(groups.some((group) => group === `User-agent: ${bot}\nDisallow: /`), bot);
  }
  assert.equal(robotsDocument({ origin: ORIGIN, preview: true }), "User-agent: *\nDisallow: /\n");
});

test("ai.txt writes a site's own policy wording as comments, so edited text cannot add a directive", () => {
  const txt = aiTxt({ origin: ORIGIN, name: "Sample", contact: "hello@example.com", policy: ["Allow: everything", "# kept"] });
  const directives = txt.split("\n").filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(directives, ["User-agent: *", "Allow: /", "Training: disallow", `Sitemap: ${ORIGIN}/sitemap.xml`, `Content-index: ${ORIGIN}/llms.txt`]);
});

test("a missing or unreadable date writes no tag, and the Article schema agrees with the Open Graph tags", () => {
  const facts = { published: null, modified: "not a date", tags: [] };
  const tags = headTags({ origin: ORIGIN, path: "/p", title: "T", description: "D", image: "/card.png", article: facts });
  assert.ok(!tags.some((tag) => "property" in tag && tag.property.endsWith("_time")));
  assert.ok(tags.some((tag) => "property" in tag && tag.property === "og:image" && tag.content === `${ORIGIN}/card.png`));

  const dated = { published: "2026-06-21T09:30:00Z" };
  const og = headTags({ origin: ORIGIN, path: "/p", title: "T", description: "D", image: "/c.png", article: dated });
  const schema = article({ url: `${ORIGIN}/p`, headline: "T", ...dated });
  const modified = og.find((tag) => "property" in tag && tag.property === "article:modified_time");
  assert.equal(modified && "content" in modified ? modified.content : undefined, schema.dateModified);
  assert.ok(!("keywords" in schema) && !("description" in schema));
});

test("headHtml escapes attributes and keeps </script> inside JSON-LD from ending the element", () => {
  const html = headHtml([
    { name: "description", content: 'a "quoted" <b>' },
    jsonLd({ headline: "</script><script>alert(1)</script>" }),
  ]);
  assert.ok(html.includes('content="a &quot;quoted&quot; &lt;b&gt;"'));
  assert.equal(html.match(/<\/script>/g)?.length, 1);
  assert.deepEqual(JSON.parse(html.slice(html.indexOf(">", html.indexOf("ld+json")) + 1, html.lastIndexOf("</script>"))), {
    headline: "</script><script>alert(1)</script>",
  });
  const tags = headTags({ origin: ORIGIN, path: "/post", title: "T", description: "D", image: "/c.png", markdown: "/post.md" });
  assert.ok(headHtml(tags).includes(`<link rel="alternate" type="text/markdown" href="${ORIGIN}/post.md">`));
});

const page = (/** @type {string} */ path, /** @type {string} */ title, /** @type {string} */ description, canonical = `${ORIGIN}${path}`) =>
  `<html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}"><meta property="og:image" content="${ORIGIN}/c.png"></head>`;

test("the audit finds a broken link through a trailing slash, a redirect chain once, a link to a redirect and a duplicate title", () => {
  const { findings, pages, summary } = auditPages(
    [
      { url: `${ORIGIN}/`, status: 200, html: `${page("/", "Same", "one")}<body><a href="/gone/#top">x</a><a href="/older">o</a><a href="https://other.example/">y</a></body></html>` },
      { url: `${ORIGIN}/b`, status: 200, html: `${page("/b", "Same", "two")}<body></body></html>`, inSitemap: true },
      { url: `${ORIGIN}/gone`, status: 404 },
      { url: `${ORIGIN}/old`, status: 301, location: "/older" },
      { url: `${ORIGIN}/older`, status: 301, location: "/oldest" },
      { url: `${ORIGIN}/oldest`, status: 308, location: "/b" },
    ],
    { origin: ORIGIN },
  );
  const checks = findings.map((finding) => `${finding.check} ${finding.url}`).sort();
  assert.deepEqual(checks, [
    `link-broken ${ORIGIN}/`,
    `link-redirect ${ORIGIN}/`,
    `redirect-chain ${ORIGIN}/old`,
    `title-duplicate ${ORIGIN}/`,
    `title-duplicate ${ORIGIN}/b`,
  ]);
  assert.equal(findings.find((finding) => finding.check === "redirect-chain")?.detail, `${ORIGIN}/old -> ${ORIGIN}/older -> ${ORIGIN}/oldest -> ${ORIGIN}/b`);
  assert.equal(pages, 6);
  assert.equal(summary["title-duplicate"], 2);
});

test("a canonical must be on the production origin, and a sitemap page's canonical must be itself", () => {
  const { findings } = auditPages(
    [
      { url: `${ORIGIN}/a`, status: 200, html: page("/a", "A", "a", "https://sample.workers.dev/a") },
      { url: `${ORIGIN}/b`, status: 200, html: page("/b", "B", "b", `${ORIGIN}/a`) },
      { url: `${ORIGIN}/c/`, status: 200, html: page("/c/", "C", "c", `${ORIGIN}/c`) },
    ],
    { origin: ORIGIN, sitemap: [`${ORIGIN}/b`, `${ORIGIN}/c/`] },
  );
  assert.deepEqual(findings.map((finding) => `${finding.check} ${finding.url}`).sort(), [`canonical-elsewhere ${ORIGIN}/b`, `canonical-off-site ${ORIGIN}/a`]);
});

test("the crawl follows a sitemap index and each redirect hop, checks unlisted links by status, skips nofollow links, and records a failed fetch", async () => {
  /** @type {Record<string, () => Response>} */
  const site = {
    "/sitemap.xml": () => new Response(`<sitemapindex><sitemap><loc>${ORIGIN}/pages.xml</loc></sitemap></sitemapindex>`),
    "/pages.xml": () => new Response(`<urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/old</loc></url><url><loc>${ORIGIN}/down</loc></url></urlset>`),
    "/": () => new Response(`${page("/", "Home", "home")}<body><a href="/missing">m</a><a href="/moved">v</a><a href="/admin" rel="nofollow">a</a></body></html>`, { headers: { "content-type": "text/html" } }),
    "/old": () => new Response(null, { status: 301, headers: { location: "/older" } }),
    "/older": () => new Response(null, { status: 301, headers: { location: "/" } }),
    "/moved": () => new Response(null, { status: 302, headers: { location: "/" } }),
    "/admin": () => new Response(null, { status: 302, headers: { location: "https://sample.cloudflareaccess.com/" } }),
  };
  /** @type {string[]} */
  const methods = [];
  /** @type {typeof fetch} */
  const fake = async (input, init) => {
    const { pathname } = new URL(String(input));
    methods.push(`${init?.method ?? "GET"} ${pathname}`);
    if (pathname === "/down") throw new Error("connection reset");
    if (pathname === "/missing" && init?.method === "HEAD") return new Response(null, { status: 405 });
    return site[pathname]?.() ?? new Response("not found", { status: 404 });
  };
  const { pages, sitemap } = await crawlSite({ origin: ORIGIN, fetch: fake });
  assert.deepEqual(sitemap, [`${ORIGIN}/`, `${ORIGIN}/old`, `${ORIGIN}/down`]);
  assert.ok(methods.includes("HEAD /moved") && methods.includes("GET /missing"));
  assert.ok(!methods.some((each) => each.endsWith(" /admin")));
  assert.deepEqual(pages.find((each) => each.url === `${ORIGIN}/down`), { url: `${ORIGIN}/down`, status: 0, error: "connection reset" });

  const { findings } = auditPages(pages, { origin: ORIGIN, sitemap });
  assert.deepEqual(findings.map((finding) => `${finding.check} ${finding.url}`).sort(), [
    `fetch-failed ${ORIGIN}/down`,
    `link-broken ${ORIGIN}/`,
    `link-redirect ${ORIGIN}/`,
    `redirect-chain ${ORIGIN}/old`,
    `sitemap-broken ${ORIGIN}/down`,
    `sitemap-redirect ${ORIGIN}/old`,
  ]);
  assert.equal((await crawlSite({ origin: ORIGIN, fetch: fake, maxPages: 2 })).pages.length, 2);
});

test("a cut title fits the limit with its ellipsis and drops the site suffix, and the audit counts an entity as the one character it stands for", () => {
  const long = "Dustin Edwards, Professor of Virology, Microbiology, and Science Writing at Tarleton";
  const cut = truncateForSerp(long, SERP_TITLE_LIMIT);
  assert.ok(cut.length <= SERP_TITLE_LIMIT, cut);
  assert.equal(cut, "Dustin Edwards, Professor of Virology, Microbiology, and...");
  assert.equal(searchTitle("Short", " | Sample"), "Short | Sample");
  assert.equal(searchTitle(long, " | Sample"), cut);
  const title = `Dustin&#x27;s ${"x".repeat(SERP_TITLE_LIMIT - 9)}`;
  const { findings } = auditPages([{ url: `${ORIGIN}/`, status: 200, html: `${page("/", title, "one")}<body></body></html>` }], { origin: ORIGIN });
  assert.equal(findings.filter((finding) => finding.check === "title-long").length, 0);
});
