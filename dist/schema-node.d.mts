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
/** @param {SchemaNode} fields */
export function compact(fields: SchemaNode): {
    [k: string]: unknown;
};
export type SchemaNode = Record<string, unknown>;
