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
export function rssItem(post: {
    slug: string;
    title: string;
    html: string | null;
    description: string | null;
    publishAt: unknown;
    tags: string[];
    author?: string;
    guid?: string;
}, origin: string, itemPath?: string): string;
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
 * }} feed `lastBuildDate` is when the content last changed (the newest post), never the clock, so a render stays cacheable
 * @returns {string}
 */
export function rssDocument(feed: {
    title: string;
    link: string;
    description: string;
    selfUrl: string;
    posts: Array<Parameters<typeof rssItem>[0]>;
    origin: string;
    itemPath?: string;
    lastBuildDate?: unknown;
    image?: {
        url: string;
        title: string;
        link: string;
    };
}): string;
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
 * }} post
 * @param {string} origin
 * @param {string} [itemPath]
 * @returns {string}
 */
export function atomEntry(post: {
    slug: string;
    title: string;
    html: string | null;
    description: string | null;
    publishAt: unknown;
    updatedAt: unknown;
    tags: string[];
}, origin: string, itemPath?: string): string;
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
export function atomDocument(feed: {
    title: string;
    subtitle: string;
    alternateUrl: string;
    selfUrl: string;
    authorName: string;
    posts: Array<Parameters<typeof atomEntry>[0]>;
    origin: string;
    itemPath?: string;
}): string;
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
export function feedItem(post: {
    slug: string;
    title: string;
    body: string;
    description: string | null;
    publishAt: unknown;
    updatedAt: unknown;
    coverImage: string | null;
    tags: string[];
}, origin: string, itemPath?: string): {
    id: string;
    url: string;
    title: string;
    content_text: string;
    summary: string;
    date_published: string;
    date_modified: string;
    tags: string[];
    image: string;
};
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
 * }} feed
 */
export function jsonFeedDocument(feed: {
    title: string;
    homePageUrl: string;
    feedUrl: string;
    description: string;
    authorName: string;
    posts: Array<Parameters<typeof feedItem>[0]>;
    origin: string;
    itemPath?: string;
}): {
    version: string;
    title: string;
    home_page_url: string;
    feed_url: string;
    description: string;
    language: string;
    authors: {
        name: string;
        url: string;
    }[];
    items: {
        id: string;
        url: string;
        title: string;
        content_text: string;
        summary: string;
        date_published: string;
        date_modified: string;
        tags: string[];
        image: string;
    }[];
};
