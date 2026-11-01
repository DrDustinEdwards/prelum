// The parts of the SEO helpers a mistake in would ship silently: a named robots group that drops the disallow list opens every
// private path to that crawler; an empty date tag claims a page has no date; `</script>` in a title would end the JSON-LD; and an
// audit that compares URLs by their exact spelling misses a broken link written with a trailing slash or a fragment, and
// one that lets a workers.dev canonical or a redirect chain through calls a site clean that search engines do not. A cut
// title that runs past the limit with its "...", or an entity the audit reads as extra characters, warns on every page. An
// image's license node without a rights field, or an Article image under Google's size, is structured data Google ignores. A favicon that answers HTML, or a manifest icon that 404s, is a blank tab and a broken
// install that no page check sees.

import assert from "node:assert/strict";
import test from "node:test";

import { auditPages, crawlSite } from "../audit.mjs";
import { defineHead, headHtml, headTags, metaText, SERP_TITLE_LIMIT, searchTitle, truncateForSerp } from "../head.mjs";
import { auditIcons, icoFile, iconLinks, webManifest } from "../icons.mjs";
import { llmsResponse } from "../llms.mjs";
import { aiTxt, DENIED_BOTS, robotsDocument, robotsResponse } from "../robots.mjs";
import { article, articleImageSet, imageObject, jsonLd, videoObject } from "../schema.mjs";

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

test("a share image's type is the one served, never a resized URL's extension; X's alt fits 420 characters; schema claims only what is known", () => {
  const alt = `A ${"long ".repeat(100)}alt`;
  const head = (/** @type {Partial<import("../head.mjs").HeadInput>} */ more) => {
    const tags = headTags({ origin: ORIGIN, path: "/p", title: "T", description: "D", image: "/c.JPG", ...more });
    return (/** @type {string} */ key) => tags.map((tag) => ("content" in tag && (("property" in tag && tag.property === key) || ("name" in tag && tag.name === key)) ? tag.content : null)).find(Boolean);
  };
  const content = head({ image: { url: "/c.JPG", width: 1200, height: 630, alt } });
  assert.equal(content("og:image:type"), "image/jpeg");
  assert.equal(content("og:image:alt"), alt);
  assert.ok((content("twitter:image:alt") ?? "").length <= 420);
  // C3: a size URL is served as WebP or AVIF whatever its name says, so only the type the site passes is written.
  assert.equal(head({ image: "/media/c.jpg?w=1200&r=40x21" })("og:image:type"), undefined);
  assert.equal(head({ image: { url: "/media/c.jpg?w=1200&r=40x21", type: "image/webp" } })("og:image:type"), "image/webp");
  // E4: each video the page plays.
  const video = head({ videos: [{ url: "/media/demo.mp4", width: 640, height: 360 }, { url: "https://www.youtube-nocookie.com/embed/x", type: "text/html" }] });
  assert.equal(video("og:video:secure_url"), `${ORIGIN}/media/demo.mp4`);
  assert.equal(video("og:video:type"), "video/mp4");
  assert.equal(video("og:video:width"), "640");
  assert.deepEqual(
    videoObject({ name: "Demo", thumbnailUrl: `${ORIGIN}/p.jpg`, uploadDate: "2026-10-31", contentUrl: `${ORIGIN}/demo.mp4`, width: 640, height: 360 }),
    { "@context": "https://schema.org", "@type": "VideoObject", name: "Demo", thumbnailUrl: `${ORIGIN}/p.jpg`, uploadDate: "2026-10-31T00:00:00.000Z", contentUrl: `${ORIGIN}/demo.mp4`, width: 640, height: 360 },
  );
  assert.throws(() => videoObject({ name: "Demo", thumbnailUrl: "", uploadDate: "2026-10-31", contentUrl: "x" }), /are required/);
  // C6: the three crops in Google's order, each with the picture's rights, and a crop that is not its ratio refused.
  const set = articleImageSet({ "1x1": { url: "/s", width: 1200, height: 1200 }, "16x9": { url: "/w", width: 1200, height: 675 } }, { creditText: "Sample" });
  assert.deepEqual(set.map((i) => [i.url, i.creditText]), [["/w", "Sample"], ["/s", "Sample"]]);
  assert.throws(() => articleImageSet({ "4x3": { url: "/x", width: 1200, height: 675 } }), /not 4:3/);

  assert.equal(imageObject({ url: `${ORIGIN}/a.png`, width: 800, height: 600 }), null);
  assert.deepEqual(imageObject({ url: `${ORIGIN}/a.png`, license: `${ORIGIN}/license`, creator: { name: "Sample" } }), {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    url: `${ORIGIN}/a.png`,
    contentUrl: `${ORIGIN}/a.png`,
    creator: { "@type": "Person", name: "Sample" },
    license: `${ORIGIN}/license`,
  });
  const crops = [`${ORIGIN}/16x9.png`, { url: `${ORIGIN}/4x3.png`, width: 800, height: 600 }];
  const images = /** @type {unknown[]} */ (article({ url: `${ORIGIN}/p`, headline: "T", image: crops }).image);
  assert.equal(images[0], crops[0]);
  assert.equal(/** @type {Record<string, unknown>} */ (images[1])["@type"], "ImageObject");
  assert.throws(() => article({ url: `${ORIGIN}/p`, headline: "T", image: { url: `${ORIGIN}/s.png`, width: 200, height: 200 } }), /under Google's 50000 pixels/);
});

const CARD = headHtml(headTags({ origin: ORIGIN, path: "/", title: "", description: "", image: { url: "/c.png", width: 1200, height: 630, alt: "A card" } }).filter((tag) => "property" in tag && tag.property.startsWith("og:image")));
const page = (/** @type {string} */ path, /** @type {string} */ title, /** @type {string} */ description, canonical = `${ORIGIN}${path}`) =>
  `<html><head><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}">${CARD}</head>`;

test("the audit finds a broken link through a trailing slash, a redirect chain once, a link to a redirect and a duplicate title", () => {
  const { findings, pages, summary } = auditPages(
    [
      { url: `${ORIGIN}/`, status: 200, html: `${page("/", "Same", "one")}<body><a href="/gone/#top">x</a><a href="/older">o</a><a href="https://other.example/">y</a></body></html>` },
      { url: `${ORIGIN}/b`, status: 200, html: `${page("/b", "Same", "two")}<body><img src="/i/IMG_0042.JPG" alt="IMG_0042"><img src="/rule.svg" alt=""></body></html>`, inSitemap: true },
      { url: `${ORIGIN}/bare`, status: 200, html: `${page("/bare", "Bare", "three").replace(CARD, headHtml(headTags({ origin: ORIGIN, path: "/", title: "", description: "", image: "/c.png" }).filter((tag) => "property" in tag && tag.property.startsWith("og:image"))))}</html>` },
      { url: `${ORIGIN}/gone`, status: 404 },
      { url: `${ORIGIN}/old`, status: 301, location: "/older" },
      { url: `${ORIGIN}/older`, status: 301, location: "/oldest" },
      { url: `${ORIGIN}/oldest`, status: 308, location: "/b" },
    ],
    { origin: ORIGIN },
  );
  const checks = findings.map((finding) => `${finding.check} ${finding.url}`).sort();
  assert.deepEqual(checks, [
    `card-incomplete ${ORIGIN}/bare`,
    `image-alt-filename ${ORIGIN}/b`,
    `link-broken ${ORIGIN}/`,
    `link-redirect ${ORIGIN}/`,
    `redirect-chain ${ORIGIN}/old`,
    `title-duplicate ${ORIGIN}/`,
    `title-duplicate ${ORIGIN}/b`,
  ]);
  assert.equal(findings.find((finding) => finding.check === "redirect-chain")?.detail, `${ORIGIN}/old -> ${ORIGIN}/older -> ${ORIGIN}/oldest -> ${ORIGIN}/b`);
  assert.equal(findings.find((finding) => finding.check === "card-incomplete")?.detail, "no og:image:width, og:image:height, og:image:alt, so the card is drawn late or unnamed");
  assert.equal(pages, 7);
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
  const long = "Alex Rivera, Director of Research, Operations, and Communications at Example Co";
  const cut = truncateForSerp(long, SERP_TITLE_LIMIT);
  assert.ok(cut.length <= SERP_TITLE_LIMIT, cut);
  assert.equal(cut, "Alex Rivera, Director of Research, Operations, and...");
  assert.equal(searchTitle("Short", " | Sample"), "Short | Sample");
  assert.equal(searchTitle(long, " | Sample"), cut);
  const title = `Jordan&#x27;s ${"x".repeat(SERP_TITLE_LIMIT - 9)}`;
  const { findings } = auditPages([{ url: `${ORIGIN}/`, status: 200, html: `${page("/", title, "one")}<body></body></html>` }], { origin: ORIGIN });
  assert.equal(findings.filter((finding) => finding.check === "title-long").length, 0);
});

test("a request on any other origin is a preview: robots.txt disallows everything and nothing is cached or indexed", async () => {
  const live = robotsResponse({ origin: ORIGIN, request: new Request(`${ORIGIN}/robots.txt`), disallow: ["/admin"] });
  const body = await live.text();
  assert.ok(body.includes("Disallow: /admin") && body.includes(`# LLM guide: ${ORIGIN}/llms.txt`));
  assert.equal(live.headers.get("x-robots-tag"), null);
  assert.equal(live.headers.get("tdm-reservation"), "1");

  const preview = robotsResponse({ origin: ORIGIN, request: new Request("https://sample.workers.dev/robots.txt") });
  assert.equal(await preview.text(), "User-agent: *\nDisallow: /\n");
  assert.equal(preview.headers.get("cache-control"), "no-store");

  const llms = llmsResponse({ origin: ORIGIN, request: new Request(`${ORIGIN}/llms.txt`), body: "# Sample\n" });
  assert.equal(llms.headers.get("x-robots-tag"), "noindex");
});

test("the canonical drops a trailing slash but keeps the home page's and an opted-out route's", () => {
  const head = defineHead({ origin: ORIGIN, siteName: "Sample", image: "/card.png", suffix: " | Sample" });
  const canonical = (/** @type {Record<string, unknown>} */ page) => {
    const tag = head({ title: "T", description: "D", path: "/", ...page }).find((tag) => "rel" in tag && tag.rel === "canonical");
    return tag && "href" in tag ? tag.href : undefined;
  };
  assert.equal(canonical({ path: "/about/" }), `${ORIGIN}/about`);
  assert.equal(canonical({ path: "/" }), `${ORIGIN}/`);
  assert.equal(canonical({ path: "/feed/news/", keepTrailingSlash: true }), `${ORIGIN}/feed/news/`);
});

test("metaText decodes entities only after the tags are gone, so escaped markup stays text", () => {
  assert.equal(metaText("<p>Tom &amp; Jerry&#39;s <b>&lt;script&gt;</b>&nbsp;tale</p><script>x()</script>"), "Tom & Jerry's <script> tale");
  assert.equal(metaText("A &bogus; entity"), "A &bogus; entity");
});

test("defineHead joins each indexable page to the site with a WebPage and the trail through its named sections", () => {
  const head = defineHead({ origin: ORIGIN, siteName: "Sample", image: "/card.png", sections: { "/blog": "Blog" } });
  const ld = (/** @type {Record<string, unknown>} */ page) =>
    head({ title: "A post", description: "D", path: "/blog/2026/a-post/", ...page }).flatMap((tag) => ("script:ld+json" in tag ? [tag["script:ld+json"]] : []));
  const [post] = ld({});
  assert.deepEqual(post?.["@graph"], [
    { "@type": "WebPage", "@id": `${ORIGIN}/blog/2026/a-post#webpage`, url: `${ORIGIN}/blog/2026/a-post`, name: "A post", description: "D",
      isPartOf: { "@id": `${ORIGIN}/#website` }, breadcrumb: { "@id": `${ORIGIN}/blog/2026/a-post#breadcrumb` } },
    { "@type": "BreadcrumbList", "@id": `${ORIGIN}/blog/2026/a-post#breadcrumb`, itemListElement: [
      { "@type": "ListItem", position: 1, name: "Sample", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${ORIGIN}/blog` },
      { "@type": "ListItem", position: 3, name: "A post", item: `${ORIGIN}/blog/2026/a-post` },
    ] },
  ]);
  const home = JSON.stringify(ld({ path: "/", pageType: "CollectionPage" }));
  assert.ok(home.includes('"@type":"CollectionPage"') && !home.includes("BreadcrumbList"));
  // A top-level page's trail (home and itself) is shown nowhere, so it is not marked up either.
  const about = JSON.stringify(ld({ path: "/about", title: "About" }));
  assert.ok(about.includes('"@type":"WebPage"') && !about.includes("BreadcrumbList") && !about.includes("#breadcrumb"));
  assert.deepEqual(ld({ noindex: true }), []);
  const full = defineHead({ origin: ORIGIN, siteName: "Sample", image: "/card.png", suffix: " · Sample", sections: { "/blog": "Blog" } });
  const named = JSON.stringify(full({ title: "A post · Sample", fullTitle: true, description: "D", path: "/blog/a-post" }));
  assert.ok(named.includes('"name":"A post","description"') && !named.includes('"name":"A post · Sample"'));
  const slashed = JSON.stringify(full({ title: "A post", description: "D", path: "/blog/a-post/", keepTrailingSlash: true }));
  assert.ok(slashed.includes(`"item":"${ORIGIN}/blog/"`) && slashed.includes(`"item":"${ORIGIN}/blog/a-post/"`));
});

test("auditIcons passes the files prelum-icons writes and names a favicon that is not an image and a manifest icon that is gone", async () => {
  const ico = icoFile([16, 32].map((size) => ({ size, png: new Uint8Array(size) })));
  assert.deepEqual(Array.from(ico.subarray(0, 6)), [0, 0, 1, 0, 2, 0]);
  assert.equal(new DataView(ico.buffer).getUint32(6 + 16 + 12, true), 6 + 32 + 16);
  const head = iconLinks().map((link) => `<link rel="${link.rel}" href="${link.href}">`).join("");
  const site = (/** @type {Record<string, Response>} */ overrides) => {
    /** @type {Record<string, () => Response>} */
    const files = {
      "/": () => new Response(`<html><head>${head}</head></html>`, { headers: { "content-type": "text/html" } }),
      "/site.webmanifest": () => Response.json(webManifest({ name: "Sample", themeColor: "#000000", backgroundColor: "#ffffff" })),
    };
    return /** @type {typeof fetch} */ (async (input) => {
      const path = new URL(String(input)).pathname;
      if (overrides[path]) return overrides[path];
      return files[path]?.() ?? new Response("png", { headers: { "content-type": "image/png" } });
    });
  };
  assert.deepEqual(await auditIcons({ origin: "https://example.com", fetch: site({}) }), []);
  const broken = await auditIcons({
    origin: "https://example.com",
    fetch: site({ "/favicon.ico": new Response("<html>", { headers: { "content-type": "text/html" } }), "/icon-maskable-512.png": new Response("", { status: 404 }) }),
  });
  assert.deepEqual(broken.map((finding) => [finding.check, new URL(finding.url).pathname]), [["icon-missing", "/favicon.ico"], ["icon-broken", "/icon-maskable-512.png"]]);
});
