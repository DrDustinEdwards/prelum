/**
 * @typedef {{ title: string }
 *   | { name: string, content: string }
 *   | { property: string, content: string }
 *   | { tagName: "link", rel: string, href: string }
 *   | { "script:ld+json": Record<string, unknown> }} HeadTag
 * The descriptor shapes React Router's `meta` export takes, so a route returns `headTags(...)` as it is.
 */
/**
 * @typedef {object} HeadImage
 * @property {string} url absolute, or a path on `origin`
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [alt]
 */
/**
 * @typedef {object} ArticleFacts
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified] falls back to `published`
 * @property {string} [author]
 * @property {string[]} [tags]
 */
/**
 * @typedef {object} HeadInput
 * @property {string} origin the site's production origin, never the request's: a workers.dev copy must not claim to be the page
 * @property {string} path
 * @property {string} title the `<title>`, with any site suffix already on it
 * @property {string} description
 * @property {HeadImage | string} image the page's card, or the site's default: a card is always sent
 * @property {string} [siteName]
 * @property {string} [socialTitle] `og:title` and `twitter:title`, where they differ from `title`
 * @property {string} [socialDescription]
 * @property {"website" | "article" | "book" | "profile"} [type]
 * @property {string} [canonical] an absolute URL, where it is not `origin` + `path`
 * @property {string} [locale] e.g. `en_US`
 * @property {boolean} [noindex]
 * @property {ArticleFacts} [article] `article:*` tags; pass the same facts to the schema's `article` so the two agree
 */
/**
 * The full head of a public page: title, description, canonical, Open Graph and Twitter. `twitter:card` is always
 * `summary_large_image`, because the image is required: a card without one renders as a bare link. An absent date writes no
 * tag, since an empty `article:published_time` claims there is no date.
 *
 * @param {HeadInput} input
 * @returns {HeadTag[]}
 */
export function headTags(input: HeadInput): HeadTag[];
/**
 * The ISO dates both the Open Graph tags and the Article schema write, so the two cannot disagree. A missing or unreadable
 * date is undefined.
 *
 * @param {ArticleFacts} article
 * @returns {{ published: string | undefined, modified: string | undefined }}
 */
export function articleDates(article: ArticleFacts): {
    published: string | undefined;
    modified: string | undefined;
};
/**
 * A path on `origin` made absolute; an absolute URL is kept as it is.
 *
 * @param {string} origin
 * @param {string} path
 */
export function absoluteUrl(origin: string, path: string): string;
/**
 * The tags as HTML, for a page built without React Router (a static build). Attribute values are escaped, and `<` inside
 * JSON-LD is written `\u003c`, so a title holding `</script>` cannot end the script element.
 *
 * @param {HeadTag[]} tags
 * @returns {string}
 */
export function headHtml(tags: HeadTag[]): string;
/**
 * Cut at a word boundary near `limit` and mark the cut, for a title or description shown where Google's result would clip it.
 *
 * @param {string} text
 * @param {number} limit
 */
export function truncateForSerp(text: string, limit: number): string;
/**
 * The `<title>` a search result shows: the title with the site's suffix where both fit, else the suffix dropped and the
 * title cut at a word. Only the `<title>` is shortened; pass the whole title as `socialTitle` and keep it in the heading.
 *
 * @param {string} title
 * @param {string} suffix e.g. " | Foxing"
 */
export function searchTitle(title: string, suffix: string): string;
/**
 * Google truncates by pixel width (about 600px title, 920px description), so these approximate it; a 160-character counter
 * would show text the result clips.
 */
export const SERP_TITLE_LIMIT: 60;
export const SERP_DESCRIPTION_LIMIT: 155;
/**
 * The descriptor shapes React Router's `meta` export takes, so a route returns `headTags(...)` as it is.
 */
export type HeadTag = {
    title: string;
} | {
    name: string;
    content: string;
} | {
    property: string;
    content: string;
} | {
    tagName: "link";
    rel: string;
    href: string;
} | {
    "script:ld+json": Record<string, unknown>;
};
export type HeadImage = {
    /**
     * absolute, or a path on `origin`
     */
    url: string;
    width?: number | undefined;
    height?: number | undefined;
    alt?: string | undefined;
};
export type ArticleFacts = {
    published?: string | number | Date | null | undefined;
    /**
     * falls back to `published`
     */
    modified?: string | number | Date | null | undefined;
    author?: string | undefined;
    tags?: string[] | undefined;
};
export type HeadInput = {
    /**
     * the site's production origin, never the request's: a workers.dev copy must not claim to be the page
     */
    origin: string;
    path: string;
    /**
     * the `<title>`, with any site suffix already on it
     */
    title: string;
    description: string;
    /**
     * the page's card, or the site's default: a card is always sent
     */
    image: HeadImage | string;
    siteName?: string | undefined;
    /**
     * `og:title` and `twitter:title`, where they differ from `title`
     */
    socialTitle?: string | undefined;
    socialDescription?: string | undefined;
    type?: "website" | "article" | "book" | "profile" | undefined;
    /**
     * an absolute URL, where it is not `origin` + `path`
     */
    canonical?: string | undefined;
    /**
     * e.g. `en_US`
     */
    locale?: string | undefined;
    noindex?: boolean | undefined;
    /**
     * `article:*` tags; pass the same facts to the schema's `article` so the two agree
     */
    article?: ArticleFacts | undefined;
};
