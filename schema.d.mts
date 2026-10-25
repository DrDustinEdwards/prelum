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
 * @typedef {object} ArticleInput
 * @property {string} url
 * @property {string} headline
 * @property {string | null} [description]
 * @property {string | string[]} [image]
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified]
 * @property {string[]} [tags]
 * @property {SchemaNode} [author]
 * @property {SchemaNode} [publisher]
 * @property {string} [type] `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
 */
/**
 * An article, with its dates from the same `articleDates` the Open Graph tags use.
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
export type ArticleInput = {
    url: string;
    headline: string;
    description?: string | null | undefined;
    image?: string | string[] | undefined;
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
