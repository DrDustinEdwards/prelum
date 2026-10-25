// What a feed reader or validator sees in the RSS, Atom and JSON Feed documents: the elements it requires, the dates it
// sorts by, text that stays text however it is punctuated, and links that resolve on the reader's origin, not this one.
// Assertions read elements back out of the document rather than comparing it byte for byte, so a change of layout
// alone fails nothing here.

import assert from "node:assert/strict";
import test from "node:test";

import { atomDocument, atomEntry, jsonFeedDocument, rssDocument, rssItem } from "../index.mjs";

const ORIGIN = "https://x.test";
const NASTY = `Tom & "Jerry" <b>'s</b>`;
const NASTY_ESCAPED = "Tom &amp; &quot;Jerry&quot; &lt;b&gt;&apos;s&lt;/b&gt;";

/**
 * Enough of an XML parser to say what a validator would: every tag closes in order, an attribute value holds no `<` or
 * bare quote, `&` only starts an entity, and no `<` is loose in text. CDATA sections are taken out first, whole.
 *
 * @param {string} xml
 */
function assertWellFormed(xml) {
  const body = xml.replace(/^<\?xml [^?]*\?>/, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  assert.doesNotMatch(body, /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/, "a bare & in text or an attribute");
  /** @type {string[]} */
  const open = [];
  const tag = /<(\/?)([A-Za-z][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>/y;
  let i = 0;
  while (i < body.length) {
    const lt = body.indexOf("<", i);
    if (lt === -1) break;
    tag.lastIndex = lt;
    const m = tag.exec(body);
    assert.ok(m, `not a tag at ${JSON.stringify(body.slice(lt, lt + 40))}`);
    const [whole, closing, name, , selfClosing] = m;
    if (closing) assert.equal(open.pop(), name, `</${name}> closes the wrong element`);
    else if (!selfClosing) open.push(name);
    i = lt + whole.length;
  }
  assert.deepEqual(open, [], "elements left open");
}

/** The text of every `<name>` element directly in `xml`, unescaped no further. */
const all = (/** @type {string} */ xml, /** @type {string} */ name) =>
  [...xml.matchAll(new RegExp(`<${name}(?: [^>]*)?>([\\s\\S]*?)</${name}>`, "g"))].map((m) => m[1]);
const one = (/** @type {string} */ xml, /** @type {string} */ name) => {
  const found = all(xml, name);
  assert.equal(found.length, 1, `expected one <${name}>, found ${found.length}`);
  return found[0];
};
const attr = (/** @type {string} */ xml, /** @type {RegExp} */ tagPattern, /** @type {string} */ name) =>
  [...xml.matchAll(tagPattern)].map((m) => m[0].match(new RegExp(`\\b${name}="([^"]*)"`))?.[1]);

const post = (/** @type {Record<string, unknown>} */ over = {}) => ({
  slug: "first",
  title: "First",
  html: "<p>Body</p>",
  description: "Summary",
  publishAt: "2026-06-21T09:30:00Z",
  updatedAt: null,
  tags: /** @type {string[]} */ ([]),
  ...over,
});

const rssFeed = (/** @type {ReturnType<typeof post>[]} */ posts) => ({
  title: "Site",
  link: `${ORIGIN}/`,
  description: "About",
  selfUrl: `${ORIGIN}/feed.xml`,
  origin: ORIGIN,
  posts,
});
const atomFeed = (/** @type {ReturnType<typeof post>[]} */ posts) => ({
  title: "Site",
  subtitle: "About",
  alternateUrl: `${ORIGIN}/`,
  selfUrl: `${ORIGIN}/atom.xml`,
  authorName: "Author",
  origin: ORIGIN,
  posts,
});

test("feeds: an RSS item has the elements a reader lists it by", () => {
  const xml = rssDocument(rssFeed([post({ tags: ["a", "b"] })]));
  assertWellFormed(xml);
  const item = one(xml, "item");
  assert.equal(one(item, "title"), "First");
  assert.equal(one(item, "link"), `${ORIGIN}/writing/first`);
  assert.equal(one(item, "guid"), `${ORIGIN}/writing/first`);
  assert.match(item, /<guid isPermaLink="true">/);
  assert.equal(one(item, "description"), "Summary");
  assert.equal(one(item, "content:encoded"), "<![CDATA[<p>Body</p>]]>");
  assert.equal(one(item, "pubDate"), "Sun, 21 Jun 2026 09:30:00 GMT");
  assert.deepEqual(all(item, "category"), ["a", "b"]);
});

test("feeds: a stored guid is kept over the link, so a renamed post is not announced again", () => {
  const item = one(rssDocument(rssFeed([post({ slug: "renamed", guid: "site-post-7" })])), "item");
  assert.equal(one(item, "guid"), "site-post-7");
  assert.match(item, /<guid isPermaLink="false">/);
  assert.equal(one(item, "link"), `${ORIGIN}/writing/renamed`);
});

test("feeds: an RSS channel names itself and its own URL", () => {
  const xml = rssDocument(rssFeed([]));
  assertWellFormed(xml);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2.0"/);
  const channel = one(xml, "channel");
  assert.equal(all(channel, "title")[0], "Site");
  assert.equal(all(channel, "link")[0], `${ORIGIN}/`);
  assert.equal(all(channel, "description")[0], "About");
  assert.deepEqual(attr(channel, /<atom:link [^>]*\/>/g, "href"), [`${ORIGIN}/feed.xml`]);
  assert.deepEqual(all(channel, "item"), []);
});

test("feeds: an Atom entry has the elements a validator requires", () => {
  const xml = atomDocument(atomFeed([post({ tags: ["a", "b"], updatedAt: "2026-07-01T00:00:00Z" })]));
  assertWellFormed(xml);
  const entry = one(xml, "entry");
  assert.equal(one(entry, "title"), "First");
  assert.equal(one(entry, "id"), `${ORIGIN}/writing/first`);
  assert.deepEqual(attr(entry, /<link [^>]*\/>/g, "href"), [`${ORIGIN}/writing/first`]);
  assert.equal(one(entry, "updated"), "2026-07-01T00:00:00.000Z");
  assert.equal(one(entry, "published"), "2026-06-21T09:30:00.000Z");
  assert.equal(one(entry, "summary"), "Summary");
  assert.equal(one(entry, "content"), "<![CDATA[<p>Body</p>]]>");
  assert.deepEqual(attr(entry, /<category [^>]*\/>/g, "term"), ["a", "b"]);
});

test("feeds: an Atom feed names itself, its author and its own URL", () => {
  const xml = atomDocument(atomFeed([post()]));
  assertWellFormed(xml);
  assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  const head = xml.slice(0, xml.indexOf("<entry>"));
  assert.equal(one(head, "title"), "Site");
  assert.equal(one(head, "subtitle"), "About");
  assert.equal(one(head, "id"), `${ORIGIN}/`);
  assert.equal(one(head, "name"), "Author");
  assert.equal(one(head, "uri"), ORIGIN);
  assert.deepEqual(attr(head, /<link [^>]*\/>/g, "rel"), ["alternate", "self"]);
  assert.deepEqual(attr(head, /<link [^>]*\/>/g, "href"), [`${ORIGIN}/`, `${ORIGIN}/atom.xml`]);
});

test("feeds: a post with no body, summary, date or tags omits those elements rather than sending them empty", () => {
  const bare = post({ html: null, description: null, publishAt: null });
  const item = rssItem(bare, ORIGIN);
  for (const name of ["description", "content:encoded", "pubDate", "category"]) assert.doesNotMatch(item, new RegExp(`<${name}`));
  assert.equal(one(item, "title"), "First");
  const entry = atomEntry(bare, ORIGIN);
  for (const name of ["published", "summary", "content", "category"]) assert.doesNotMatch(entry, new RegExp(`<${name}[ >]`));
  // An Atom entry with no `updated` is invalid, so an undated one gets the epoch.
  assert.equal(one(entry, "updated"), "1970-01-01T00:00:00.000Z");
});

test("feeds: an Atom entry's updated falls back to its published date", () => {
  assert.equal(one(atomEntry(post(), ORIGIN), "updated"), "2026-06-21T09:30:00.000Z");
});

test("feeds: the Atom feed's updated is its newest post's latest date, and the epoch when it has none", () => {
  const xml = atomDocument(
    atomFeed([
      post({ slug: "old", publishAt: "2026-01-01T00:00:00Z" }),
      post({ slug: "edited", publishAt: "2026-02-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }),
      post({ slug: "new", publishAt: "2026-08-01T00:00:00Z" }),
      post({ slug: "draft", publishAt: undefined, updatedAt: undefined }),
    ]),
  );
  assertWellFormed(xml);
  assert.equal(one(xml.slice(0, xml.indexOf("<entry>")), "updated"), "2026-09-01T00:00:00.000Z");
  const empty = atomDocument(atomFeed([]));
  assertWellFormed(empty);
  assert.equal(one(empty, "updated"), "1970-01-01T00:00:00.000Z");
  assert.doesNotMatch(empty, /<entry>/);
});

test("feeds: Date objects are dated the same as ISO strings", () => {
  const when = new Date("2026-06-21T09:30:00Z");
  assert.equal(one(rssItem(post({ publishAt: when }), ORIGIN), "pubDate"), "Sun, 21 Jun 2026 09:30:00 GMT");
  assert.equal(one(atomEntry(post({ publishAt: when }), ORIGIN), "published"), "2026-06-21T09:30:00.000Z");
});

test("feeds: &, <, > and quotes in every text field stay text in RSS and Atom", () => {
  const nasty = post({ slug: "a&b", title: NASTY, description: NASTY, tags: [NASTY] });
  const rss = rssDocument({ ...rssFeed([nasty]), title: NASTY, description: NASTY, link: `${ORIGIN}/?a=1&b=2`, selfUrl: `${ORIGIN}/f?x="y"` });
  assertWellFormed(rss);
  const item = one(rss, "item");
  assert.equal(one(item, "title"), NASTY_ESCAPED);
  assert.equal(one(item, "description"), NASTY_ESCAPED);
  assert.deepEqual(all(item, "category"), [NASTY_ESCAPED]);
  assert.equal(one(item, "link"), `${ORIGIN}/writing/a&amp;b`);
  assert.equal(one(item, "guid"), `${ORIGIN}/writing/a&amp;b`);
  assert.equal(all(rss, "title")[0], NASTY_ESCAPED);
  assert.equal(all(rss, "link")[0], `${ORIGIN}/?a=1&amp;b=2`);
  assert.deepEqual(attr(rss, /<atom:link [^>]*\/>/g, "href"), [`${ORIGIN}/f?x=&quot;y&quot;`]);

  const atom = atomDocument({ ...atomFeed([nasty]), title: NASTY, subtitle: NASTY, authorName: NASTY });
  assertWellFormed(atom);
  const entry = one(atom, "entry");
  assert.equal(one(entry, "title"), NASTY_ESCAPED);
  assert.equal(one(entry, "summary"), NASTY_ESCAPED);
  assert.equal(one(entry, "id"), `${ORIGIN}/writing/a&amp;b`);
  assert.deepEqual(attr(entry, /<category [^>]*\/>/g, "term"), [NASTY_ESCAPED]);
  const head = atom.slice(0, atom.indexOf("<entry>"));
  assert.equal(one(head, "title"), NASTY_ESCAPED);
  assert.equal(one(head, "subtitle"), NASTY_ESCAPED);
  assert.equal(one(head, "name"), NASTY_ESCAPED);
});

test("feeds: a body containing ]]> does not end its CDATA section early", () => {
  const html = "<p>a[0]]>b</p>";
  const rss = rssDocument(rssFeed([post({ html })]));
  const atom = atomDocument(atomFeed([post({ html })]));
  for (const xml of [rss, atom]) {
    assertWellFormed(xml);
    const sections = [...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]).join("");
    assert.equal(sections, html);
  }
});

test("feeds: root-relative links and KaTeX in a body are made readable on someone else's origin", () => {
  const html = `<a href="/about">a</a><img src="/i.png"><span class="katex"><annotation encoding="application/x-tex">x</annotation></span>`;
  const expected = `<![CDATA[<a href="${ORIGIN}/about">a</a><img src="${ORIGIN}/i.png">$x$]]>`;
  assert.equal(one(rssItem(post({ html }), ORIGIN), "content:encoded"), expected);
  assert.equal(one(atomEntry(post({ html }), ORIGIN), "content"), expected);
});

test("feeds: a long post and many posts come through whole and in order", () => {
  const long = "word & ".repeat(5000);
  const posts = Array.from({ length: 50 }, (_, n) => post({ slug: `p${n}`, title: `${n} ${long}`, html: `<p>${long}</p>` }));
  const rss = rssDocument(rssFeed(posts));
  const atom = atomDocument(atomFeed(posts));
  assertWellFormed(rss);
  assertWellFormed(atom);
  const titles = posts.map((p) => p.title.replace(/&/g, "&amp;"));
  assert.deepEqual(all(rss, "item").map((i) => one(i, "title")), titles);
  assert.deepEqual(all(atom, "entry").map((e) => one(e, "title")), titles);
  assert.equal(one(all(rss, "item")[49], "content:encoded"), `<![CDATA[<p>${long}</p>]]>`);
});

test("feeds: a post lives under /writing unless itemPath says otherwise", () => {
  assert.equal(one(rssItem(post(), ORIGIN), "link"), `${ORIGIN}/writing/first`);
  assert.equal(one(atomEntry(post(), ORIGIN), "id"), `${ORIGIN}/writing/first`);
  const doc = jsonFeedDocument({
    title: "Site",
    homePageUrl: `${ORIGIN}/`,
    feedUrl: `${ORIGIN}/feed.json`,
    description: "About",
    authorName: "Author",
    origin: ORIGIN,
    posts: [{ ...post(), body: "b", coverImage: null }],
  });
  assert.equal(doc.items[0].url, `${ORIGIN}/writing/first`);
});

const jsonPost = (/** @type {Record<string, unknown>} */ over = {}) => ({
  slug: "first",
  title: NASTY,
  body: "Body text",
  description: "Summary",
  publishAt: "2026-06-21T09:30:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  coverImage: "/img/c.png",
  tags: ["a"],
  ...over,
});

test("feeds: a JSON Feed is version 1.1 with the fields a reader requires, and survives a round trip", () => {
  const doc = jsonFeedDocument({
    title: NASTY,
    homePageUrl: `${ORIGIN}/`,
    feedUrl: `${ORIGIN}/feed.json`,
    description: "About",
    authorName: "Author",
    origin: ORIGIN,
    itemPath: "/blog",
    posts: [jsonPost(), jsonPost({ slug: "second" })],
  });
  const read = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(read, {
    version: "https://jsonfeed.org/version/1.1",
    title: NASTY,
    home_page_url: `${ORIGIN}/`,
    feed_url: `${ORIGIN}/feed.json`,
    description: "About",
    language: "en-US",
    authors: [{ name: "Author", url: ORIGIN }],
    items: ["first", "second"].map((slug) => ({
      id: `${ORIGIN}/blog/${slug}`,
      url: `${ORIGIN}/blog/${slug}`,
      title: NASTY,
      content_text: "Body text",
      summary: "Summary",
      date_published: "2026-06-21T09:30:00.000Z",
      date_modified: "2026-07-01T00:00:00.000Z",
      tags: ["a"],
      image: `${ORIGIN}/img/c.png`,
    })),
  });
});

test("feeds: a JSON Feed item drops an empty optional field instead of sending it empty", () => {
  const doc = jsonFeedDocument({
    title: "Site",
    homePageUrl: `${ORIGIN}/`,
    feedUrl: `${ORIGIN}/feed.json`,
    description: "About",
    authorName: "Author",
    origin: ORIGIN,
    posts: [jsonPost({ description: null, publishAt: null, updatedAt: null, coverImage: null, tags: [] })],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(doc.items[0])), {
    id: `${ORIGIN}/writing/first`,
    url: `${ORIGIN}/writing/first`,
    title: NASTY,
    content_text: "Body text",
  });
});

test("rss: lastBuildDate, the channel image and an item's author are written when given", () => {
  const image = { url: `${ORIGIN}/favicon.png`, title: "Site", link: `${ORIGIN}/blog` };
  const xml = rssDocument({
    ...rssFeed([post({ author: `support@x.test (${NASTY})` })]),
    lastBuildDate: new Date("2026-08-01T12:00:00Z"),
    image,
  });
  assertWellFormed(xml);
  assert.equal(one(xml, "lastBuildDate"), "Sat, 01 Aug 2026 12:00:00 GMT");
  assert.deepEqual(
    { url: one(one(xml, "image"), "url"), title: one(one(xml, "image"), "title"), link: one(one(xml, "image"), "link") },
    image,
  );
  assert.equal(one(xml, "author"), `support@x.test (${NASTY_ESCAPED})`);
});
