/**
 * @typedef {Record<string, unknown>} SchemaNode
 */
/**
 * The descriptor React Router's `meta` serializes into a `<script type="application/ld+json">`; `headHtml` writes the same.
 *
 * @param {SchemaNode} node
 * @returns {{ "script:ld+json": SchemaNode }}
 */
export function jsonLd(node: SchemaNode): {
    "script:ld+json": SchemaNode;
};
/**
 * Any schema.org type, with the context added and every empty field dropped: `undefined`, `null`, `""` and `[]` would each
 * claim a value the page does not have. Person, Organization, Book, Event and the rest are this, with the site's own fields.
 *
 * @param {string} type
 * @param {SchemaNode} fields
 * @returns {SchemaNode}
 */
export function thing(type: string, fields: SchemaNode): SchemaNode;
/**
 * Several nodes as one `@graph`, joined by their `@id`s, with the context written once.
 *
 * @param {SchemaNode[]} nodes
 * @returns {SchemaNode}
 */
export function graph(nodes: SchemaNode[]): SchemaNode;
/**
 * The site itself. There is no SearchAction unless `searchUrl` is given: one is a promise that the template is a working search.
 *
 * @param {{ origin: string, name: string, description?: string, searchUrl?: string, publisher?: SchemaNode }} site
 *   `searchUrl` holds `{search_term_string}` where the query goes
 */
export function website({ origin, name, description, searchUrl, publisher }: {
    origin: string;
    name: string;
    description?: string;
    searchUrl?: string;
    publisher?: SchemaNode;
}): Record<string, unknown>;
/**
 * An image as an ImageObject, for `primaryImageOfPage` on a page that is not an article, or one of an Article's `image`s. Its
 * rights (`creditText`, `creator`, `copyrightNotice`, `license`, `acquireLicensePage`) are written when known.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode}
 */
export function pageImage({ url, width, height, caption, creditText, creator, copyrightNotice, license, acquireLicensePage }: ImageInput): SchemaNode;
/**
 * An image's license metadata, which Google Images shows as its credit and Licensable badge
 * (https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata): null unless one of `creator`,
 * `creditText`, `copyrightNotice` or `license` is known, since Google requires one of them beside `contentUrl`. The badge
 * needs `license`, and `acquireLicensePage` is recommended with it. One node per licensable image on the page.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode | null}
 */
export function imageObject(image: ImageInput): SchemaNode | null;
/** Google's least for an Article image, width times height (https://developers.google.com/search/docs/appearance/structured-data/article). */
export const ARTICLE_IMAGE_MIN_PIXELS: 50000;
/**
 * @typedef {object} ArticleInput
 * @property {string} url
 * @property {string} headline
 * @property {string | null} [description]
 * @property {ArticleImage | ArticleImage[]} [image] Google asks for several crops, 16:9, 4:3 and 1:1, each at least
 *   `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and `height` are given and smaller is refused
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified]
 * @property {string[]} [tags]
 * @property {SchemaNode} [author]
 * @property {SchemaNode} [publisher]
 * @property {string} [type] `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
 */
/**
 * An article, with its dates from the same `articleDates` the Open Graph tags use. A URL image is written as it is, and an
 * `ImageInput` as `pageImage` writes it.
 *
 * @param {ArticleInput} article
 */
export function article({ url, headline, description, image, published, modified, tags, author, publisher, type }: ArticleInput): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(origin: string, trail: Array<{
    name: string;
    path: string;
}>): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string }>} items
 */
export function itemList(origin: string, name: string, items: Array<{
    name: string;
    path: string;
}>): Record<string, unknown>;
/** @param {Array<{ question: string, answer: string }>} faqs */
export function faqPage(faqs: Array<{
    question: string;
    answer: string;
}>): Record<string, unknown>;
export type SchemaNode = Record<string, unknown>;
export type ImageInput = {
    /**
     * the image file itself, absolute
     */
    url: string;
    /**
     * in pixels
     */
    width?: number | undefined;
    height?: number | undefined;
    caption?: string | undefined;
    /**
     * the name credited where the image is published
     */
    creditText?: string | undefined;
    /**
     * a Person unless `type` says Organization
     */
    creator?: {
        name: string;
        type?: "Person" | "Organization";
    } | undefined;
    copyrightNotice?: string | undefined;
    /**
     * a page that says how the image may be used
     */
    license?: string | undefined;
    /**
     * a page that says how to license it
     */
    acquireLicensePage?: string | undefined;
};
/**
 * a URL, an image to write as an ImageObject, or a node `pageImage` built
 */
export type ArticleImage = string | ImageInput | SchemaNode;
export type ArticleInput = {
    url: string;
    headline: string;
    description?: string | null | undefined;
    /**
     * Google asks for several crops, 16:9, 4:3 and 1:1, each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and
     * `height` are given and smaller is refused
     */
    image?: ArticleImage | ArticleImage[] | undefined;
    published?: string | number | Date | null | undefined;
    modified?: string | number | Date | null | undefined;
    tags?: string[] | undefined;
    author?: Record<string, unknown> | undefined;
    publisher?: Record<string, unknown> | undefined;
    /**
     * `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
     */
    type?: string | undefined;
};
