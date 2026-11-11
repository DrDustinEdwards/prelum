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
export function toMatchExpression(
  parsed: {
    terms: string[];
    phrases?: string[];
  },
  prefix?: boolean,
): string | null;
/**
 * Rank based, never score based: bm25 from two indexes with different tokenizers is not comparable on value. k = 60 is the
 * original RRF paper's constant. ranks and contributions are parallel to sources.
 *
 * @template {{ uid: string }} T
 * @param {T[][]} lists
 * @param {number} [k]
 * @returns {Array<{ item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>}
 */
export function fuse<
  T extends {
    uid: string;
  },
>(
  lists: T[][],
  k?: number,
): Array<{
  item: T;
  score: number;
  sources: number[];
  ranks: number[];
  contributions: number[];
}>;
/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K: 60;
/** One page of a static search index, as `staticSearchIndex` writes it: url, title, summary, headings [id, text] and text. */
export type StaticSearchPage = {
  u: string;
  t: string;
  s: string;
  h: Array<[string, string]>;
  x: string;
};
/** A static search index: what the build writes and the search page loads. */
export type StaticSearchIndex = { v: 1; pages: StaticSearchPage[] };
/** One result of `staticSearch`; `url` points to the heading that matched most words, when one did. */
export type StaticSearchResult = {
  url: string;
  title: string;
  summary: string;
  heading: string | null;
  snippet: string;
  score: number;
};
/**
 * Search for a site with no database: the build writes the index once, the search page ranks with `staticSearch` in the
 * browser. Each page keeps at most `maxText` characters of its text (default 4000).
 */
export function staticSearchIndex(
  pages: Array<{
    url: string;
    title: string;
    summary?: string;
    headings?: Array<{ id: string; text: string }>;
    text?: string;
  }>,
  options?: { maxText?: number },
): StaticSearchIndex;
/** The query's words, folded as `slugify` folds them (café to cafe), split on anything not a letter or digit. */
export function searchWords(query: string): string[];
/**
 * Ranks the pages: every word must start a word somewhere in a page (the last may be cut short); the title counts most,
 * then a heading, the summary and the text, with a bonus when the title is exactly the query. At most `limit` results
 * (default 50), snippets of about `snippet` characters (default 160).
 */
export function staticSearch(
  index: StaticSearchIndex,
  query: string,
  options?: { limit?: number; snippet?: number },
): StaticSearchResult[];
/** A LIKE pattern matching `text` anywhere, with `%`, `_` and the backslash escaped, for `col LIKE ? ESCAPE '\'`. */
export function likeContains(text: string): string;
/** A typed query: what was typed, its bare terms (ANDed) and quoted phrases, its `name:value` filters by operator, a year. */
export type ParsedQuery = {
  raw: string;
  terms: string[];
  phrases: string[];
  filters: Record<string, string[]>;
  year: number | null;
  isEmpty: boolean;
};
/**
 * Parse a typed search: quoted phrases first, then `name:value` operators (each name in `operators`, values lowercased), then the
 * first bare year inside `minYear` (default 2000) to `maxYear` (default next year) as a date filter; the rest are terms.
 */
export function parseQuery(
  input: string,
  options?: { operators?: string[]; minYear?: number; maxYear?: number },
): ParsedQuery;
/** True when the query filters by an operator or a year; a filter-only query has no text for FTS5. */
export function hasFilters(parsed: Pick<ParsedQuery, "filters" | "year">): boolean;
/** `?sort=date` is "date"; anything else is "relevance", the default. */
export function parseSort(value: string | null | undefined): "relevance" | "date";
/** Hits as given for relevance; newest `publishAt` first for date, undated last. */
export function applySort<T extends { publishAt: number | null }>(
  hits: T[],
  sort: "relevance" | "date",
): T[];
/** The one spelling of the published status. */
export const PUBLISHED_STATUS: "published";
/** Published, and `publishAt` missing or past; a `publishAt` that does not parse is not public. */
export function isPubliclyVisible(
  post: { status?: string; publishAt?: string | Date | number | null },
  nowMs?: number,
): boolean;
/** The longest no-result search a site keeps. */
export const ZERO_RESULT_MAX_LENGTH: 200;
/**
 * A no-result search as a site may keep it (lowercased, single spaces), or null when it must not be kept: a fragment, too long,
 * no letter or digit, or shaped like an email address, a phone number or a person's name.
 */
export function normalizeZeroResultQuery(raw: string): string | null;
