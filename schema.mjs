import { absoluteUrl, articleDates } from "./head.mjs";

const CONTEXT = "https://schema.org";

/**
 * @typedef {Record<string, unknown>} SchemaNode
 */

/**
 * The descriptor React Router's `meta` serializes into a `<script type="application/ld+json">`; `headHtml` writes the same.
 *
 * @param {SchemaNode} node
 * @returns {{ "script:ld+json": SchemaNode }}
 */
export function jsonLd(node) {
  return { "script:ld+json": node };
}

/**
 * Any schema.org type, with the context added and every empty field dropped: `undefined`, `null`, `""` and `[]` would each
 * claim a value the page does not have. Person, Organization, Book, Event and the rest are this, with the site's own fields.
 *
 * @param {string} type
 * @param {SchemaNode} fields
 * @returns {SchemaNode}
 */
export function thing(type, fields) {
  return { "@context": CONTEXT, "@type": type, ...compact(fields) };
}

/**
 * Several nodes as one `@graph`, joined by their `@id`s, with the context written once.
 *
 * @param {SchemaNode[]} nodes
 * @returns {SchemaNode}
 */
export function graph(nodes) {
  return {
    "@context": CONTEXT,
    "@graph": nodes.map((node) => Object.fromEntries(Object.entries(node).filter(([key]) => key !== "@context"))),
  };
}

/**
 * The site itself. There is no SearchAction unless `searchUrl` is given: one is a promise that the template is a working search.
 *
 * @param {{ origin: string, name: string, description?: string, searchUrl?: string, publisher?: SchemaNode }} site
 *   `searchUrl` holds `{search_term_string}` where the query goes
 */
export function website({ origin, name, description, searchUrl, publisher }) {
  return thing("WebSite", {
    "@id": `${origin}/#website`,
    url: origin,
    name,
    description,
    publisher,
    potentialAction: searchUrl
      ? { "@type": "SearchAction", target: searchUrl, "query-input": "required name=search_term_string" }
      : undefined,
  });
}

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
export function article({ url, headline, description, image, published, modified, tags, author, publisher, type = "Article" }) {
  const dates = articleDates({ published, modified });
  return thing(type, {
    headline,
    description,
    image,
    datePublished: dates.published,
    dateModified: dates.modified,
    keywords: tags && tags.length > 0 ? tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    author,
    publisher,
  });
}

/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(origin, trail) {
  return thing("BreadcrumbList", {
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(origin, crumb.path),
    })),
  });
}

/**
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string }>} items
 */
export function itemList(origin, name, items) {
  return thing("ItemList", {
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(origin, item.path),
    })),
  });
}

/** @param {Array<{ question: string, answer: string }>} faqs */
export function faqPage(faqs) {
  return thing("FAQPage", {
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  });
}

/** @param {SchemaNode} fields */
function compact(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0),
    ),
  );
}
