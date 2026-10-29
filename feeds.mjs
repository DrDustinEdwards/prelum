import { absolutizeUrls, cdata, escapeXml, mathToTex, toDate } from "./xml.mjs";

/*
 * RSS 2.0, Atom 1.0 and JSON Feed 1.1 from the same post rows. `<description>` keeps the summary because readers show it in the
 * LIST view; the post goes in `content:encoded`. URLs are absolutised because a feed item is read on someone else's origin.
 * `itemPath` is where a post lives under the origin ("/writing" by default), the one thing the sites disagree on.
 */

const DEFAULT_ITEM_PATH = "/writing";

/**
 * A feed date as a Date, null when there is none, and an error naming the value when it is not a date: a feed must never say
 * "Invalid Date" or fail later with an unnamed RangeError (Astro's RSS schema refuses one the same way).
 *
 * @param {unknown} value
 * @param {string} what e.g. `post "hello": publishAt`
 * @returns {Date | null}
 */
function validDate(value, what) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(/** @type {Date | number | string} */ (value), null);
  if (Number.isNaN(date.getTime())) throw new Error(`${what} is not a date: ${JSON.stringify(value)}`);
  return date;
}

/**
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   tags: string[],
 *   author?: string,
 *   guid?: string,
 * }} post one row of `listBlogPostsRendered`; `author` is RSS's own form, an email address with the name in brackets;
 *   `guid` is a permanent id stored at first publish, so a changed slug does not announce the post again (the link
 *   otherwise)
 * @param {string} origin the site origin, no trailing slash
 * @param {string} [itemPath]
 */
export function rssItem(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  const url = `${origin}${itemPath}/${post.slug}`;
  const published = validDate(post.publishAt, `post "${post.slug}": publishAt`)?.toUTCString();

  return [
    "    <item>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    post.guid
      ? `      <guid isPermaLink="false">${escapeXml(post.guid)}</guid>`
      : `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
    post.description ? `      <description>${escapeXml(post.description)}</description>` : null,
    // Omitted rather than empty: an empty `content:encoded` tells a reader the post IS empty.
    post.html
      ? `      <content:encoded>${cdata(absolutizeUrls(mathToTex(post.html), origin))}</content:encoded>`
      : null,
    published ? `      <pubDate>${published}</pubDate>` : null,
    post.author ? `      <author>${escapeXml(post.author)}</author>` : null,
    ...post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`),
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{
 *   title: string,
 *   link: string,
 *   description: string,
 *   selfUrl: string,
 *   posts: Array<Parameters<typeof rssItem>[0]>,
 *   origin: string,
 *   itemPath?: string,
 *   lastBuildDate?: unknown,
 *   image?: { url: string, title: string, link: string },
 *   language?: string,
 * }} feed `lastBuildDate` is when the content last changed (the newest post), never the clock, so a render stays cacheable;
 *   `language` is `en-us` by default
 * @returns {string}
 */
export function rssDocument(feed) {
  const items = feed.posts.map((post) => rssItem(post, feed.origin, feed.itemPath)).join("\n");
  const built = validDate(feed.lastBuildDate, "lastBuildDate");
  const lastBuildDate = built ? `\n    <lastBuildDate>${built.toUTCString()}</lastBuildDate>` : "";
  const image = feed.image
    ? `\n    <image>
      <url>${escapeXml(feed.image.url)}</url>
      <title>${escapeXml(feed.image.title)}</title>
      <link>${escapeXml(feed.image.link)}</link>
    </image>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.link)}</link>
    <description>${escapeXml(feed.description)}</description>
    <language>${escapeXml(feed.language ?? "en-us")}</language>${lastBuildDate}
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml" />${image}
${items}
  </channel>
</rss>
`;
}

/**
 * The body is CDATA rather than escaped inline: double-escaping is how a feed
 * ends up showing tags as text. No rendered HTML means no `<content>` at all,
 * since an empty one asserts the post is empty.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   html: string | null,
 *   description: string | null,
 *   publishAt: unknown,
 *   updatedAt: unknown,
 *   tags: string[],
 *   guid?: string,
 * }} post `guid` is the same permanent id RSS uses, an IRI such as `urn:example:...`, so a changed slug does not announce the
 *   post again (the link otherwise)
 * @param {string} origin
 * @param {string} [itemPath]
 * @returns {string}
 */
export function atomEntry(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  const url = `${origin}${itemPath}/${post.slug}`;
  const published = validDate(post.publishAt, `post "${post.slug}": publishAt`);
  const updated = validDate(post.updatedAt, `post "${post.slug}": updatedAt`) ?? published;

  return [
    "    <entry>",
    `      <title>${escapeXml(post.title)}</title>`,
    `      <link href="${escapeXml(url)}" rel="alternate" type="text/html" />`,
    `      <id>${escapeXml(post.guid ?? url)}</id>`,
    // An entry with no `updated` is invalid Atom, hence the epoch fallback.
    `      <updated>${(updated ?? new Date(0)).toISOString()}</updated>`,
    published ? `      <published>${published.toISOString()}</published>` : null,
    post.description ? `      <summary>${escapeXml(post.description)}</summary>` : null,
    post.html
      ? `      <content type="html">${cdata(absolutizeUrls(mathToTex(post.html), origin))}</content>`
      : null,
    ...post.tags.map((tag) => `      <category term="${escapeXml(tag)}" />`),
    "    </entry>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * @param {{
 *   title: string,
 *   subtitle: string,
 *   alternateUrl: string,
 *   selfUrl: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof atomEntry>[0]>,
 *   origin: string,
 *   itemPath?: string,
 * }} feed
 * @returns {string}
 */
export function atomDocument(feed) {
  const entries = feed.posts.map((post) => atomEntry(post, feed.origin, feed.itemPath)).join("\n");
  // Derived from the rows rather than a clock, so two renders of the same corpus
  // are byte-identical and the edge can cache them. An empty feed gets the epoch,
  // which validates where an empty `<updated>` does not.
  const newest = feed.posts
    .map((post) => validDate(post.updatedAt ?? post.publishAt, `post "${post.slug}": updatedAt or publishAt`)?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(feed.title)}</title>
  <subtitle>${escapeXml(feed.subtitle)}</subtitle>
  <link href="${escapeXml(feed.alternateUrl)}" rel="alternate" type="text/html" />
  <link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/atom+xml" />
  <id>${escapeXml(feed.alternateUrl)}</id>
  <updated>${new Date(newest).toISOString()}</updated>
  <author><name>${escapeXml(feed.authorName)}</name><uri>${escapeXml(feed.origin)}</uri></author>
${entries}
</feed>
`;
}

/**
 * Undefined-valued keys are how an optional field is omitted (JSON.stringify
 * drops them), so a direct consumer must judge presence by value, not by `in`.
 *
 * @param {{
 *   slug: string,
 *   title: string,
 *   body: string,
 *   description: string | null,
 *   publishAt: unknown,
 *   updatedAt: unknown,
 *   coverImage: string | null,
 *   tags: string[],
 * }} post one row of `listBlogPostsFullText`
 * @param {string} origin the site origin, no trailing slash
 * @param {string} [itemPath]
 */
export function feedItem(post, origin, itemPath = DEFAULT_ITEM_PATH) {
  return {
    id: `${origin}${itemPath}/${post.slug}`,
    url: `${origin}${itemPath}/${post.slug}`,
    title: post.title,
    // JSON Feed 1.1 requires content_html or content_text on every item.
    content_text: post.body,
    summary: post.description ?? undefined,
    date_published: validDate(post.publishAt, `post "${post.slug}": publishAt`)?.toISOString(),
    date_modified: validDate(post.updatedAt, `post "${post.slug}": updatedAt`)?.toISOString(),
    tags: post.tags.length > 0 ? post.tags : undefined,
    // A path on the origin, or an absolute URL (a CDN) kept as it is.
    image: post.coverImage ? new URL(post.coverImage, origin).href : undefined,
  };
}

/**
 * @param {{
 *   title: string,
 *   homePageUrl: string,
 *   feedUrl: string,
 *   description: string,
 *   authorName: string,
 *   posts: Array<Parameters<typeof feedItem>[0]>,
 *   origin: string,
 *   itemPath?: string,
 *   language?: string,
 * }} feed `language` is `en-US` by default
 */
export function jsonFeedDocument(feed) {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: feed.title,
    home_page_url: feed.homePageUrl,
    feed_url: feed.feedUrl,
    description: feed.description,
    language: feed.language ?? "en-US",
    authors: [{ name: feed.authorName, url: feed.origin }],
    items: feed.posts.map((post) => feedItem(post, feed.origin, feed.itemPath)),
  };
}
