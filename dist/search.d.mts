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
 * @returns {string | null} null when there is nothing to match on (a term with no letter or digit counts as nothing)
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
/** @typedef {{ u: string, t: string, s: string, h: Array<[string, string]>, x: string }} StaticSearchPage One page of a static search index: url, title, summary, headings [id, text] and text. */
/** @typedef {{ v: 1, pages: StaticSearchPage[] }} StaticSearchIndex A static search index: what the build writes and the search page loads. */
/** @typedef {{ url: string, title: string, summary: string, heading: string | null, snippet: string, score: number }} StaticSearchResult One result of `staticSearch`; `url` points to the heading that matched most words, when one did. */
/**
 * Search for a site with no database (a static build, such as a gallery or a design system's docs): the build writes the
 * index once with `staticSearchIndex`, the search page loads it and ranks with `staticSearch`, in the browser. Words are
 * folded as `slugify` folds them (café finds cafe), every word must match, and the last one matches as a prefix.
 *
 * @param {Array<{ url: string, title: string, summary?: string, headings?: Array<{ id: string, text: string }>, text?: string }>} pages
 * @param {{ maxText?: number }} [options] each page keeps at most `maxText` characters of its text (default 4000)
 * @returns {StaticSearchIndex}
 */
export function staticSearchIndex(pages: Array<{
    url: string;
    title: string;
    summary?: string;
    headings?: Array<{
        id: string;
        text: string;
    }>;
    text?: string;
}>, { maxText }?: {
    maxText?: number;
}): StaticSearchIndex;
/**
 * The query's words, folded. Anything that is not a letter or digit separates words.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function searchWords(query: string): string[];
/**
 * Ranks an index's pages against a query: every word must appear somewhere in a page, as the start of a word (the last
 * word may be cut short, so "butt" finds "button"). A page scores each word by the best field it is in, with a bonus when
 * the title is exactly the query. A result links to the heading that matched most words, and its snippet is the text
 * around the first match.
 *
 * @param {StaticSearchIndex} index
 * @param {string} query
 * @param {{ limit?: number, snippet?: number }} [options] at most `limit` results (default 50); snippets of about
 *   `snippet` characters (default 160)
 * @returns {StaticSearchResult[]}
 */
export function staticSearch(index: StaticSearchIndex, query: string, { limit, snippet }?: {
    limit?: number;
    snippet?: number;
}): StaticSearchResult[];
/**
 * A LIKE pattern matching `text` anywhere in a column, with `%`, `_` and the backslash escaped, for `col LIKE ? ESCAPE '\'`. Unescaped, a
 * search for "50%" or "a_b" matches rows it should not.
 *
 * @param {string} text
 * @returns {string}
 */
export function likeContains(text: string): string;
/** @typedef {{ raw: string, terms: string[], phrases: string[], filters: Record<string, string[]>, year: number | null, isEmpty: boolean }} ParsedQuery A typed query: what was typed, its bare terms (ANDed) and quoted phrases, its `name:value` filters by operator, a year. */
/**
 * A typed search query, from dustinedwards.info's search (app/lib/search/query.mjs). The rules apply in order and each consumes
 * its tokens: quoted phrases first, so an operator inside quotes stays text; then `name:value` operators (each name in
 * `operators`), lowercased; then the first bare four-digit year inside `minYear` to `maxYear` becomes a date filter, since
 * prose rarely spells out its own date. What is left is the terms, ANDed.
 *
 * @param {string} input
 * @param {{ operators?: string[], minYear?: number, maxYear?: number }} [options] `operators` default none; `minYear` default 2000
 *   (so 1024 or 8080 stays a term); `maxYear` default next year, read at call time so a deploy never freezes it
 * @returns {ParsedQuery}
 */
export function parseQuery(input: string, { operators, minYear, maxYear }?: {
    operators?: string[];
    minYear?: number;
    maxYear?: number;
}): ParsedQuery;
/**
 * Whether a parsed query filters (an operator or a year). A filter-only query leaves no text for FTS5, so it takes a browse path.
 *
 * @param {Pick<ParsedQuery, "filters" | "year">} parsed
 * @returns {boolean}
 */
export function hasFilters(parsed: Pick<ParsedQuery, "filters" | "year">): boolean;
/**
 * The sort a `?sort=` value asks for: "date", else "relevance", the default (a site's best pages may be old ones that a
 * date-first list buries).
 *
 * @param {string | null | undefined} value
 * @returns {"relevance" | "date"}
 */
export function parseSort(value: string | null | undefined): "relevance" | "date";
/**
 * Hits in the order `sort` asks for: as given for relevance, newest `publishAt` first for date, undated last (-Infinity, not 0,
 * which would misplace a date before 1970). Sort before paging: sorting one page of ten reads as a broken list.
 *
 * @template {{ publishAt: number | null }} T
 * @param {T[]} hits
 * @param {"relevance" | "date"} sort
 * @returns {T[]}
 */
export function applySort<T extends {
    publishAt: number | null;
}>(hits: T[], sort: "relevance" | "date"): T[];
/**
 * Whether a post is public at `nowMs`: published, and its `publishAt` missing (publish at once) or past. A `publishAt` that
 * does not parse is not public: failing closed keeps a draft out of search and out of an ask box's answers.
 *
 * @param {{ status?: string, publishAt?: string | Date | number | null }} post
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isPubliclyVisible(post: {
    status?: string;
    publishAt?: string | Date | number | null;
}, nowMs?: number): boolean;
/**
 * A search that found nothing, as a site may keep it to learn what readers look for, or null when it must not be kept: shorter
 * than three characters (a fragment), longer than ZERO_RESULT_MAX_LENGTH (refused, not cut: a cut paste is the same problem),
 * no letter or digit, or shaped like an email address, a phone number or a person's name. The name shape over-matches
 * ("Cloudflare Workers") on purpose: a dropped query costs one row, a kept personal one is a record. The shapes are tested on
 * the raw text, since lowercasing destroys the name shape's only signal. Kept lowercased with single spaces.
 *
 * @param {string} raw
 * @returns {string | null}
 */
export function normalizeZeroResultQuery(raw: string): string | null;
/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K: 60;
/** The one spelling of the published status: a typo in a status literal fails open on a filter. */
export const PUBLISHED_STATUS: "published";
/** The longest search a site keeps when it found nothing. */
export const ZERO_RESULT_MAX_LENGTH: 200;
/**
 * One page of a static search index: url, title, summary, headings [id, text] and text.
 */
export type StaticSearchPage = {
    u: string;
    t: string;
    s: string;
    h: Array<[string, string]>;
    x: string;
};
/**
 * A static search index: what the build writes and the search page loads.
 */
export type StaticSearchIndex = {
    v: 1;
    pages: StaticSearchPage[];
};
/**
 * One result of `staticSearch`; `url` points to the heading that matched most words, when one did.
 */
export type StaticSearchResult = {
    url: string;
    title: string;
    summary: string;
    heading: string | null;
    snippet: string;
    score: number;
};
/**
 * A typed query: what was typed, its bare terms (ANDed) and quoted phrases, its `name:value` filters by operator, a year.
 */
export type ParsedQuery = {
    raw: string;
    terms: string[];
    phrases: string[];
    filters: Record<string, string[]>;
    year: number | null;
    isEmpty: boolean;
};
