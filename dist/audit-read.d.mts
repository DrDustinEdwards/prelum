/** @typedef {import("./audit.mjs").AuditPage} AuditPage */
/**
 * Whether an alt is a file name: the image's own, with or without its extension, or any name ending in an image extension.
 * @param {string} alt @param {string | undefined} src
 */
export function isFileName(alt: string, src: string | undefined): boolean;
/** Whether a page's canonical is the page itself, so it asks to be indexed at this URL. @param {string} head @param {string} url */
export function selfCanonical(head: string, url: string): boolean;
/** @param {AuditPage} page */
export function isRedirect(page: AuditPage): boolean;
/** The URLs a redirect passes through, from `page` to where the crawl stops, a loop cut at its first repeat. @param {AuditPage} page @param {Map<string, AuditPage>} byUrl */
export function chainFrom(page: AuditPage, byUrl: Map<string, AuditPage>): string[];
/** @param {Map<string, string[]>} map @param {string} key @param {string} url */
export function push(map: Map<string, string[]>, key: string, url: string): void;
/** A URL without its fragment or, unless `exact`, a trailing slash, so `/a/` and `/a#top` name the page `/a` names. @param {string} url @param {boolean} [exact] */
export function normalize(url: string, exact?: boolean): string;
/** `href` made absolute against `base`, without its fragment, or null when it is no URL. @param {string | undefined} href @param {string} base */
export function resolve(href: string | undefined, base: string): string | null;
/** @param {string} url @param {string} origin */
export function sameOrigin(url: string, origin: string): boolean;
/**
 * The same-origin `<a href>` targets in a page, absolute and without fragments, as written (not normalized). A
 * rel="nofollow" link, such as a sign-in link, is one the site asks crawlers not to follow, so it is left out.
 * @param {string} html @param {string} base @param {string} origin
 */
export function internalLinks(html: string, base: string, origin: string): string[];
/** @param {Record<string, string> | Headers | undefined} headers @param {string} name */
export function header(headers: Record<string, string> | Headers | undefined, name: string): string;
/** @param {string} html */
export function headOf(html: string): string;
/** @param {string} html @param {string} name */
export function elementText(html: string, name: string): string | null;
/** @param {string} html @param {"name" | "property"} key @param {string} value */
export function meta(html: string, key: "name" | "property", value: string): string | null;
/** @param {string} html */
export function jsonLdBlocks(html: string): string[];
/**
 * Every `<name ...>` tag's attributes, values entity-decoded; an attribute with no value is the empty string.
 *
 * @param {string} html
 * @param {string} name
 * @returns {Array<Record<string, string>>}
 */
export function tags(html: string, name: string): Array<Record<string, string>>;
/**
 * @typedef {{ allow: boolean, path: string }} Rule
 * @typedef {Rule[]} Group
 */
/**
 * The rules that apply to one crawler, as RFC 9309 picks them: the group naming it, else `*`; groups are not combined.
 *
 * @param {string} text robots.txt
 * @param {string} agent lower-case product token, e.g. `googlebot`
 * @returns {Group}
 */
export function robotsGroup(text: string, agent: string): Group;
/** Longest matching rule wins, and Allow wins a tie (RFC 9309 2.2.2). @param {Group} rules @param {string} path */
export function robotsAllows(rules: Group, path: string): boolean;
/**
 * What Google's structured-data pages call required, for the types a page of these sites carries; a block that parses can
 * still earn no rich result. Walks `@graph`. Only what Google documents as required is flagged, never what is merely
 * recommended (https://developers.google.com/search/docs/appearance/structured-data/breadcrumb,
 * https://developers.google.com/search/docs/appearance/structured-data/video).
 *
 * @param {unknown} data
 * @returns {string[]}
 */
export function jsonLdProblems(data: unknown): string[];
export function same(a: string, b: string): boolean;
export type AuditPage = import("./audit.mjs").AuditPage;
export type Rule = {
    allow: boolean;
    path: string;
};
export type Group = Rule[];
