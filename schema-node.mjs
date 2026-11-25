// The JSON-LD node: the context and the dropped empty fields every schema.org type is written through.

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
    "@graph": nodes.map((node) =>
      Object.fromEntries(Object.entries(node).filter(([key]) => key !== "@context")),
    ),
  };
}

/** @param {SchemaNode} fields */
export function compact(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );
}
