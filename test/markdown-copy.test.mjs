// The Markdown copies every site serves through one wrapper. A mistake here ships silently on every site at once: a copy
// that carries the site's menu or a script's text, or relative links an agent cannot follow; a browser handed Markdown; a
// site's own copy or llms-full.txt overwritten; or an llms-full.txt that lists a noindex page.

import assert from "node:assert/strict";
import test from "node:test";

import { htmlToMarkdown, markdownCopies } from "../markdown-copy.mjs";

const ORIGIN = "https://example.com";

const page = (/** @type {string} */ title, /** @type {string} */ body, /** @type {string} */ extra = "") => `<!doctype html>
<html><head><title>${title} | Sample</title><meta property="og:title" content="${title}"><meta name="description" content="About ${title}.">
<link rel="canonical" href="${ORIGIN}/${title.toLowerCase()}">${extra}<script>var secret = 1;</script></head>
<body><header><nav><a href="/">Home</a></nav></header><main><h1>${title}</h1>${body}</main><footer>Footer</footer></body></html>`;

/** A site with two pages, its own copy of one, a redirect, and a sitemap. @type {(request: Request) => Promise<Response>} */
const site = async (request) => {
  const { pathname } = new URL(request.url);
  const html = (/** @type {string} */ body) => new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Frame-Options": "DENY" } });
  if (pathname === "/about") return html(page("About", '<p>Read <a href="/notes">the notes</a>.</p><button>Menu</button><div hidden>gone</div>'));
  if (pathname === "/private") return html(page("Private", "<p>Hush.</p>", '<meta name="robots" content="noindex">'));
  if (pathname === "/old") return new Response(null, { status: 301, headers: { Location: "/about" } });
  if (pathname === "/own.md") return new Response("# Own\n", { headers: { "Content-Type": "text/markdown" } });
  if (pathname === "/llms.txt") return new Response("# Sample\n\n> A sample site.\n\nIntro line.\n\n## Pages\n\n- [About](https://example.com/about)\n");
  if (pathname === "/sitemap.xml") return new Response(`<urlset><url><loc>${ORIGIN}/about</loc></url><url><loc>${ORIGIN}/private</loc></url></urlset>`);
  return new Response("Not found", { status: 404 });
};
const wrapped = markdownCopies(site, { origin: ORIGIN });
const get = (/** @type {string} */ path, /** @type {Record<string, string>} */ headers = {}) => wrapped(new Request(`${ORIGIN}${path}`, { headers }));

test("a page's copy is its main text only, with absolute links and the title as its one top heading", () => {
  const copy = htmlToMarkdown(page("About", '<h2>Part</h2><p>See <a href="/notes">notes</a>.</p><nav>skip</nav><svg><text>chart</text></svg>'), { base: ORIGIN });
  assert.equal(copy.title, "About");
  assert.equal(copy.description, "About About.");
  assert.equal(copy.canonical, `${ORIGIN}/about`);
  assert.equal(copy.markdown, `## Part\n\nSee [notes](${ORIGIN}/notes).`);
});

test("/path.md and Accept: text/markdown answer the copy; a browser gets the HTML, told where the copy is", async () => {
  const md = await get("/old.md");
  assert.equal(md.headers.get("Content-Type"), "text/markdown; charset=utf-8");
  assert.equal(md.headers.get("Link"), `<${ORIGIN}/about>; rel="canonical"`);
  assert.equal(md.headers.get("Vary"), null);
  assert.equal(md.headers.get("X-Frame-Options"), "DENY");
  const text = await md.text();
  assert.match(text, /^# About\n\n> About About\.\n\nSource: https:\/\/example\.com\/about\n\nRead \[the notes\]\(https:\/\/example\.com\/notes\)\.\n$/);

  const negotiated = await get("/about", { Accept: "text/markdown, text/html;q=0.5" });
  assert.equal(negotiated.headers.get("Vary"), "Accept");
  assert.equal(await negotiated.text(), text);

  const browser = await get("/about", { Accept: "text/html,*/*;q=0.8" });
  assert.match(browser.headers.get("Content-Type") ?? "", /^text\/html/);
  assert.match(browser.headers.get("Link") ?? "", /<https:\/\/example\.com\/about\.md>; rel="alternate"; type="text\/markdown"/);
  assert.equal((await get("/own.md")).headers.get("Content-Type"), "text/markdown");
  assert.equal((await get("/missing.md")).status, 404);
});

test("llms-full.txt is built from llms.txt and the sitemap, without noindex pages", async () => {
  const full = await (await get("/llms-full.txt")).text();
  assert.ok(full.startsWith("# Sample\n\n> A sample site.\n\nIntro line.\n"), full);
  assert.match(full, /# About\n/);
  assert.doesNotMatch(full, /Private|Hush/);
});
