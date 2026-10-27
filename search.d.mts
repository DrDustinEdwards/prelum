/**
 * Every token is quoted: fts5 has its own query language, so unquoted input breaks on a hyphen and NEAR silently changes the
 * meaning. Doubling embedded quotes is the whole escape.
 *
 * @param {string} token
 * @returns {string}
 */
export function ftsLiteral(token: string): string;
/**
 * An FTS5 MATCH expression from already-split words and phrases, every one a literal, all ANDed.
 *
 * @param {{ terms: string[], phrases?: string[] }} parsed
 * @param {boolean} [prefix] when true the LAST term also matches as a prefix, so "cloudf" finds "cloudflare" while someone is
 *   still typing. Only the last term, because the earlier ones are complete words the moment a space follows them.
 * @returns {string | null} null when there is nothing to match on
 */
export function toMatchExpression(parsed: {
    terms: string[];
    phrases?: string[];
}, prefix?: boolean): string | null;
/**
 * Rank based, never score based: bm25 from two indexes with different tokenizers is not comparable on value. k = 60 is the
 * original RRF paper's constant. ranks and contributions are parallel to sources.
 *
 * @template {{ uid: string }} T
 * @param {T[][]} lists
 * @param {number} [k]
 * @returns {Array<{ item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>}
 */
export function fuse<T extends {
    uid: string;
}>(lists: T[][], k?: number): Array<{
    item: T;
    score: number;
    sources: number[];
    ranks: number[];
    contributions: number[];
}>;
/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K: 60;
/** One page of a static search index, as `staticSearchIndex` writes it: url, title, summary, headings [id, text] and text. */
export type StaticSearchPage = { u: string; t: string; s: string; h: Array<[string, string]>; x: string };
/** A static search index: what the build writes and the search page loads. */
export type StaticSearchIndex = { v: 1; pages: StaticSearchPage[] };
/** One result of `staticSearch`; `url` points to the heading that matched most words, when one did. */
export type StaticSearchResult = { url: string; title: string; summary: string; heading: string | null; snippet: string; score: number };
/**
 * Search for a site with no database: the build writes the index once, the search page ranks with `staticSearch` in the
 * browser. Each page keeps at most `maxText` characters of its text (default 4000).
 */
export function staticSearchIndex(
  pages: Array<{ url: string; title: string; summary?: string; headings?: Array<{ id: string; text: string }>; text?: string }>,
  options?: { maxText?: number },
): StaticSearchIndex;
/** The query's words, folded as `slugify` folds them (café to cafe), split on anything not a letter or digit. */
export function searchWords(query: string): string[];
/**
 * Ranks the pages: every word must start a word somewhere in a page (the last may be cut short); the title counts most,
 * then a heading, the summary and the text, with a bonus when the title is exactly the query. At most `limit` results
 * (default 50), snippets of about `snippet` characters (default 160).
 */
export function staticSearch(index: StaticSearchIndex, query: string, options?: { limit?: number; snippet?: number }): StaticSearchResult[];
