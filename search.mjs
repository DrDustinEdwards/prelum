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
  return `"${token.replace(/"/g, '""')}"`;
}

/**
 * An FTS5 MATCH expression from already-split words and phrases, every one a literal, all ANDed.
 *
 * @param {{ terms: string[], phrases?: string[] }} parsed
 * @param {boolean} [prefix] when true the LAST term also matches as a prefix, so "cloudf" finds "cloudflare" while someone is
 *   still typing. Only the last term, because the earlier ones are complete words the moment a space follows them.
 * @returns {string | null} null when there is nothing to match on
 */
export function toMatchExpression(parsed, prefix = false) {
  /** @type {string[]} */
  const parts = [];
  for (const phrase of parsed.phrases ?? []) parts.push(ftsLiteral(phrase));
  parsed.terms.forEach((term, i) => {
    const isLast = i === parsed.terms.length - 1;
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
        scores.set(item.uid, { item, score: contribution, sources: [listIndex], ranks: [rank], contributions: [contribution] });
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
  const squash = (/** @type {string | undefined} */ s) => String(s ?? "").replace(/\s+/g, " ").trim();
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
const fold = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The query's words, folded. Anything that is not a letter or digit separates words.
 *
 * @param {string} query
 * @returns {string[]}
 */
export function searchWords(query) {
  return fold(String(query)).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
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
  const patterns = words.map((w, i) => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(w)}${i === words.length - 1 ? "" : "(?![\\p{L}\\p{N}])"}`, "u"));
  const whole = words.join(" ");
  /** @type {Array<{ url: string, title: string, summary: string, heading: string | null, snippet: string, score: number }>} */
  const results = [];
  for (const page of index.pages) {
    const fields = { t: fold(page.t), h: page.h.map(([, text]) => fold(text)), s: fold(page.s), x: fold(page.x) };
    let score = 0;
    let every = true;
    for (const re of patterns) {
      const best = re.test(fields.t) ? WEIGHT.t : fields.h.some((h) => re.test(h)) ? WEIGHT.h : re.test(fields.s) ? WEIGHT.s : re.test(fields.x) ? WEIGHT.x : 0;
      if (best === 0) {
        every = false;
        break;
      }
      score += best;
    }
    if (!every) continue;
    if (searchWords(page.t).join(" ") === whole) score += 10;
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
    results.push({ url: heading ? `${page.u}#${heading}` : page.u, title: page.t, summary: page.s, heading: heading ? (page.h.find(([id]) => id === heading)?.[1] ?? null) : null, snippet: first < 0 && page.s ? page.s : text, score });
  }
  return results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
