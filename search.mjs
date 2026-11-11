/** Reciprocal rank fusion constant. See fuse(). */
export const RRF_K = 60;

/**
 * Every token is quoted: fts5 has its own query language, so unquoted input breaks on a hyphen and NEAR silently changes the
 * meaning. Doubling embedded quotes is the whole escape.
 *
 * @param {string} token
 * @returns {string}
 */
export function ftsLiteral(token) {
  return `"${token.replace(/\0/g, "").replace(/"/g, '""')}"`;
}

/**
 * An FTS5 MATCH expression from already-split words and phrases, every one a literal, all ANDed.
 *
 * @param {{ terms: string[], phrases?: string[] }} parsed
 * @param {boolean} [prefix] when true the LAST term also matches as a prefix, so "cloudf" finds "cloudflare" while someone is
 *   still typing. Only the last term, because the earlier ones are complete words the moment a space follows them.
 * @returns {string | null} null when there is nothing to match on (a term with no letter or digit counts as nothing)
 */
export function toMatchExpression(parsed, prefix = false) {
  // A term of only punctuation tokenizes to nothing in FTS5 and would match no row, so it is dropped; NUL ends a SQL string.
  const clean = (/** @type {string[]} */ list) =>
    list.map((text) => text.replace(/\0/g, "")).filter((text) => /[\p{L}\p{N}]/u.test(text));
  /** @type {string[]} */
  const parts = [];
  for (const phrase of clean(parsed.phrases ?? [])) parts.push(ftsLiteral(phrase));
  const terms = clean(parsed.terms);
  terms.forEach((term, i) => {
    const isLast = i === terms.length - 1;
    parts.push(prefix && isLast ? `${ftsLiteral(term)}*` : ftsLiteral(term));
  });
  if (parts.length === 0) return null;
  return parts.join(" AND ");
}

/**
 * Rank based, never score based: bm25 from two indexes with different tokenizers is not comparable on value. k = 60 is the
 * original RRF paper's constant. ranks and contributions are parallel to sources.
 *
 * @template {{ uid: string }} T
 * @param {T[][]} lists
 * @param {number} [k]
 * @returns {Array<{ item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>}
 */
export function fuse(lists, k = RRF_K) {
  /** @type {Map<string, { item: T, score: number, sources: number[], ranks: number[], contributions: number[] }>} */
  const scores = new Map();

  lists.forEach((list, listIndex) => {
    list.forEach((item, i) => {
      const rank = i + 1;
      const contribution = 1 / (k + rank);
      const existing = scores.get(item.uid);
      if (existing) {
        existing.score += contribution;
        existing.sources.push(listIndex);
        existing.ranks.push(rank);
        existing.contributions.push(contribution);
      } else {
        scores.set(item.uid, {
          item,
          score: contribution,
          sources: [listIndex],
          ranks: [rank],
          contributions: [contribution],
        });
      }
    });
  });

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

/**
 * Search for a site with no database (a static build, such as a gallery or a design system's docs): the build writes the
 * index once with `staticSearchIndex`, the search page loads it and ranks with `staticSearch`, in the browser. Words are
 * folded as `slugify` folds them (café finds cafe), every word must match, and the last one matches as a prefix.
 *
 * @param {Array<{ url: string, title: string, summary?: string, headings?: Array<{ id: string, text: string }>, text?: string }>} pages
 * @param {{ maxText?: number }} [options] each page keeps at most `maxText` characters of its text (default 4000)
 * @returns {{ v: 1, pages: Array<{ u: string, t: string, s: string, h: Array<[string, string]>, x: string }> }}
 */
export function staticSearchIndex(pages, { maxText = 4000 } = {}) {
  const squash = (/** @type {string | undefined} */ s) =>
    String(s ?? "")
      .replace(/\s+/g, " ")
      .trim();
  return {
    v: 1,
    pages: pages.map((p) => ({
      u: p.url,
      t: squash(p.title),
      s: squash(p.summary),
      h: (p.headings ?? []).map((h) => /** @type {[string, string]} */ ([h.id, squash(h.text)])),
      x: squash(p.text).slice(0, maxText),
    })),
  };
}

/** @param {string} s */
const fold = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The query's words, folded. Anything that is not a letter or digit separates words.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function searchWords(query) {
  return fold(String(query))
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// How much a match in each field counts. The title outranks a heading, a heading the summary, the summary the text.
const WEIGHT = { t: 8, h: 4, s: 2, x: 1 };

/**
 * Ranks an index's pages against a query: every word must appear somewhere in a page, as the start of a word (the last
 * word may be cut short, so "butt" finds "button"). A page scores each word by the best field it is in, with a bonus when
 * the title is exactly the query. A result links to the heading that matched most words, and its snippet is the text
 * around the first match.
 *
 * @param {{ v: 1, pages: Array<{ u: string, t: string, s: string, h: Array<[string, string]>, x: string }> }} index
 * @param {string} query
 * @param {{ limit?: number, snippet?: number }} [options] at most `limit` results (default 50); snippets of about
 *   `snippet` characters (default 160)
 * @returns {Array<{ url: string, title: string, summary: string, heading: string | null, snippet: string, score: number }>}
 */
export function staticSearch(index, query, { limit = 50, snippet = 160 } = {}) {
  const words = searchWords(query);
  if (words.length === 0) return [];
  const escape = (/** @type {string} */ w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = words.map(
    (w, i) =>
      new RegExp(
        `(?:^|[^\\p{L}\\p{N}])${escape(w)}${i === words.length - 1 ? "" : "(?![\\p{L}\\p{N}])"}`,
        "u",
      ),
  );
  const whole = words.join(" ");
  /** @type {Array<{ url: string, title: string, summary: string, heading: string | null, snippet: string, score: number }>} */
  const results = [];
  for (const page of index.pages) {
    const fields = {
      t: fold(page.t),
      h: page.h.map(([, text]) => fold(text)),
      s: fold(page.s),
      x: fold(page.x),
    };
    let score = 0;
    let every = true;
    for (const re of patterns) {
      const best = re.test(fields.t)
        ? WEIGHT.t
        : fields.h.some((h) => re.test(h))
          ? WEIGHT.h
          : re.test(fields.s)
            ? WEIGHT.s
            : re.test(fields.x)
              ? WEIGHT.x
              : 0;
      if (best === 0) {
        every = false;
        break;
      }
      score += best;
    }
    if (!every) continue;
    if (searchWords(page.t).join(" ") === whole) score += 10;
    /** @type {string | null} */
    let heading = null;
    let headingHits = 0;
    page.h.forEach(([id], i) => {
      const hits = patterns.filter((re) => re.test(fields.h[i] ?? "")).length;
      if (hits > headingHits) {
        headingHits = hits;
        heading = id;
      }
    });
    const at = patterns.map((re) => fields.x.search(re)).filter((n) => n >= 0);
    const first = at.length ? Math.min(...at) : -1;
    const start = first < 0 ? 0 : Math.max(0, first - Math.floor(snippet / 3));
    let text = page.x.slice(start, start + snippet);
    if (start > 0) text = `…${text.replace(/^\S*\s/, "")}`;
    if (start + snippet < page.x.length) text = `${text.replace(/\s\S*$/, "")}…`;
    results.push({
      url: heading ? `${page.u}#${heading}` : page.u,
      title: page.t,
      summary: page.s,
      heading: heading ? (page.h.find(([id]) => id === heading)?.[1] ?? null) : null,
      snippet: first < 0 && page.s ? page.s : text,
      score,
    });
  }
  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/**
 * A LIKE pattern matching `text` anywhere in a column, with `%`, `_` and the backslash escaped, for `col LIKE ? ESCAPE '\'`. Unescaped, a
 * search for "50%" or "a_b" matches rows it should not.
 *
 * @param {string} text
 * @returns {string}
 */
export function likeContains(text) {
  return `%${String(text).replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * A typed search query, from dustinedwards.info's search (app/lib/search/query.mjs). The rules apply in order and each consumes
 * its tokens: quoted phrases first, so an operator inside quotes stays text; then `name:value` operators (each name in
 * `operators`), lowercased; then the first bare four-digit year inside `minYear` to `maxYear` becomes a date filter, since
 * prose rarely spells out its own date. What is left is the terms, ANDed.
 *
 * @param {string} input
 * @param {{ operators?: string[], minYear?: number, maxYear?: number }} [options] `operators` default none; `minYear` default 2000
 *   (so 1024 or 8080 stays a term); `maxYear` default next year, read at call time so a deploy never freezes it
 * @returns {{ raw: string, terms: string[], phrases: string[], filters: Record<string, string[]>, year: number | null, isEmpty: boolean }}
 */
export function parseQuery(input, { operators = [], minYear = 2000, maxYear } = {}) {
  const raw = input ?? "";
  const ceiling = maxYear ?? new Date().getUTCFullYear() + 1;
  /** @type {string[]} */
  const phrases = [];
  let rest = raw.replace(/"([^"]+)"/g, (_m, /** @type {string} */ phrase) => {
    const trimmed = phrase.trim();
    if (trimmed) phrases.push(trimmed);
    return " ";
  });
  /** @type {Record<string, string[]>} */
  const filters = Object.fromEntries(operators.map((name) => [name.toLowerCase(), []]));
  if (operators.length > 0) {
    const names = operators.map((name) => name.replace(/[^a-z0-9_-]/gi, "")).join("|");
    rest = rest.replace(
      new RegExp(`\\b(${names}):([^\\s]+)`, "gi"),
      (_m, /** @type {string} */ field, /** @type {string} */ value) => {
        const clean = value.trim().toLowerCase();
        if (clean) filters[field.toLowerCase()]?.push(clean);
        return " ";
      },
    );
  }
  /** @type {number | null} */
  let year = null;
  /** @type {string[]} */
  const terms = [];
  for (const token of rest.split(/\s+/).filter(Boolean)) {
    if (year === null && /^\d{4}$/.test(token)) {
      const candidate = Number(token);
      if (candidate >= minYear && candidate <= ceiling) {
        year = candidate;
        continue;
      }
    }
    terms.push(token);
  }
  return {
    raw,
    terms,
    phrases,
    filters,
    year,
    isEmpty: terms.length === 0 && phrases.length === 0,
  };
}

/**
 * Whether a parsed query filters (an operator or a year). A filter-only query leaves no text for FTS5, so it takes a browse path.
 *
 * @param {{ filters: Record<string, string[]>, year: number | null }} parsed
 * @returns {boolean}
 */
export function hasFilters(parsed) {
  return parsed.year !== null || Object.values(parsed.filters).some((values) => values.length > 0);
}

/**
 * The sort a `?sort=` value asks for: "date", else "relevance", the default (a site's best pages may be old ones that a
 * date-first list buries).
 *
 * @param {string | null | undefined} value
 * @returns {"relevance" | "date"}
 */
export function parseSort(value) {
  return value === "date" ? "date" : "relevance";
}

/**
 * Hits in the order `sort` asks for: as given for relevance, newest `publishAt` first for date, undated last (-Infinity, not 0,
 * which would misplace a date before 1970). Sort before paging: sorting one page of ten reads as a broken list.
 *
 * @template {{ publishAt: number | null }} T
 * @param {T[]} hits
 * @param {"relevance" | "date"} sort
 * @returns {T[]}
 */
export function applySort(hits, sort) {
  if (sort !== "date") return hits;
  return [...hits].sort((a, b) => (b.publishAt ?? -Infinity) - (a.publishAt ?? -Infinity));
}

/** The one spelling of the published status: a typo in a status literal fails open on a filter. */
export const PUBLISHED_STATUS = "published";

/**
 * Whether a post is public at `nowMs`: published, and its `publishAt` missing (publish at once) or past. A `publishAt` that
 * does not parse is not public: failing closed keeps a draft out of search and out of an ask box's answers.
 *
 * @param {{ status?: string, publishAt?: string | Date | number | null }} post
 * @param {number} [nowMs]
 * @returns {boolean}
 */
export function isPubliclyVisible(post, nowMs = Date.now()) {
  if (post.status !== PUBLISHED_STATUS) return false;
  const at = post.publishAt;
  if (at === null || at === undefined || at === "") return true;
  const when = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at);
  return !Number.isNaN(when) && when <= nowMs;
}

/** The longest search a site keeps when it found nothing. */
export const ZERO_RESULT_MAX_LENGTH = 200;

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
export function normalizeZeroResultQuery(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length < 3 || trimmed.length > ZERO_RESULT_MAX_LENGTH) return null;
  if (/\S+@\S+/.test(trimmed)) return null;
  if (/(?:\+?\d[\d\s().-]{6,}\d)/.test(trimmed)) return null;
  if (/\b[A-Z][a-z]+\s+[A-Z][a-z]+/.test(trimmed)) return null;
  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
  return /[\p{L}\p{N}]/u.test(normalized) ? normalized : null;
}
