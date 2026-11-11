import { unescapeXml } from "./xml.mjs";

/**
 * @typedef {object} CitedWork
 * @property {string} id the record's own id, used as the BibTeX key: a second key scheme would give one work two identities
 * @property {string} title
 * @property {readonly string[]} authors
 * @property {string} [type] `article`, `review`, `abstract`, `chapter` or `teaching-resource`; anything else is an article
 * @property {string | null} [journal] the journal, or for a chapter the book
 * @property {number | null} [year]
 * @property {string | null} [publishedDate] `YYYY-MM-DD`, `YYYY-MM` or `YYYY`
 * @property {string | number | null} [volume]
 * @property {string | number | null} [issue]
 * @property {string | null} [pages] verbatim, as an article-number record has no first page
 * @property {string | null} [firstPage]
 * @property {string | null} [lastPage]
 * @property {string | null} [abstract]
 * @property {string | null} [doi] as deposited, never lowercased
 */

/**
 * @typedef {object} CitationOptions
 * @property {(name: string) => string} [author] a site's alias table, so one person's spellings export as one name
 * @property {RegExp} [protect] terms BibTeX styles must not lowercase (a genus and species); group 1 is braced
 */

/** Character references in a stored title, decoded, since a reference manager reads text and not HTML. */
const decode = (/** @type {string | number | null | undefined} */ value) =>
  unescapeXml(String(value ?? ""));

/** @param {string} name @param {CitationOptions} options */
const authorOf = (name, options) => (options.author ? options.author(name) : name).trim();

// The backslash goes first, or it escapes the escapes that follow it.
/** @type {Array<[string, string]>} */
const BIBTEX_ESCAPES = [
  ["\\", "\\textbackslash{}"],
  ["{", "\\{"],
  ["}", "\\}"],
  ["&", "\\&"],
  ["%", "\\%"],
  ["$", "\\$"],
  ["#", "\\#"],
  ["_", "\\_"],
  ["~", "\\textasciitilde{}"],
  ["^", "\\textasciicircum{}"],
];

/** @param {string | number | null | undefined} value */
function escapeBibtex(value) {
  let out = decode(value);
  for (const [from, to] of BIBTEX_ESCAPES) out = out.split(from).join(to);
  return out;
}

// misc, not electronic, which the standard styles render as nothing.
/** @type {Record<string, string>} */
const BIBTEX_TYPES = {
  article: "article",
  review: "article",
  abstract: "inproceedings",
  chapter: "incollection",
  "teaching-resource": "misc",
};

/**
 * One work as a BibTeX entry. Special characters are escaped after the entities are decoded, and `protect` braces a term
 * after escaping, or the braces would be escaped into visible punctuation. The DOI is as deposited, with a `url` at doi.org;
 * a work with no DOI has neither line, rather than a registry address that does not exist.
 *
 * @param {CitedWork} work
 * @param {CitationOptions} [options]
 * @returns {string}
 */
export function toBibtex(work, options = {}) {
  const type = BIBTEX_TYPES[work.type ?? ""] ?? "article";
  const field = (/** @type {string} */ key, /** @type {string} */ value) =>
    `  ${key} = {${value}},`;
  const protect = (/** @type {string} */ escaped) =>
    options.protect ? escaped.replace(options.protect, "{$1}") : escaped;
  const lines = [`@${type}{${work.id},`];
  lines.push(field("title", protect(escapeBibtex(work.title))));
  lines.push(
    field(
      "author",
      work.authors.map((name) => escapeBibtex(authorOf(name, options))).join(" and "),
    ),
  );
  if (work.journal) {
    lines.push(
      field(type === "incollection" ? "booktitle" : "journal", protect(escapeBibtex(work.journal))),
    );
  }
  if (work.year) lines.push(field("year", String(work.year)));
  if (work.volume) lines.push(field("volume", escapeBibtex(work.volume)));
  if (work.issue) lines.push(field("number", escapeBibtex(work.issue)));
  if (work.pages) lines.push(field("pages", escapeBibtex(work.pages)));
  if (work.doi) {
    lines.push(field("doi", work.doi));
    lines.push(field("url", `https://doi.org/${work.doi}`));
  }
  lines.push("}");
  return lines.join("\n");
}

// TY first, ER last, exactly two spaces before the dash: reference managers are strict about that.
/** @type {Record<string, string>} */
const RIS_TYPES = {
  article: "JOUR",
  review: "JOUR",
  abstract: "ABST",
  chapter: "CHAP",
  "teaching-resource": "ELEC",
};

/**
 * One work as a RIS record: `TY` first and `ER` last, tags as two letters, two spaces, a dash and a space. An author is
 * `Family, Given` from the last space of the (canonical) name.
 *
 * @param {CitedWork} work
 * @param {CitationOptions} [options]
 * @returns {string}
 */
export function toRis(work, options = {}) {
  /** @type {Array<[string, string]>} */
  const rows = [
    ["TY", RIS_TYPES[work.type ?? ""] ?? "JOUR"],
    ["TI", decode(work.title)],
  ];
  for (const name of work.authors) {
    const parts = authorOf(name, options).split(" ").filter(Boolean);
    const family = parts.length < 2 ? (parts[0] ?? "") : parts[parts.length - 1];
    const given = parts.length < 2 ? "" : parts.slice(0, -1).join(" ");
    rows.push(["AU", given ? `${family}, ${given}` : family]);
  }
  if (work.journal) rows.push(["JO", decode(work.journal)]);
  if (work.year) rows.push(["PY", String(work.year)]);
  // RIS wants slashes and tolerates a trailing empty field, which is how a partial date is expressed.
  if (work.publishedDate) rows.push(["DA", work.publishedDate.replace(/-/g, "/")]);
  if (work.volume) rows.push(["VL", String(work.volume)]);
  if (work.issue) rows.push(["IS", String(work.issue)]);
  if (work.firstPage) rows.push(["SP", work.firstPage]);
  if (work.lastPage) rows.push(["EP", work.lastPage]);
  if (work.abstract) rows.push(["AB", decode(work.abstract)]);
  if (work.doi) {
    rows.push(["DO", work.doi]);
    rows.push(["UR", `https://doi.org/${work.doi}`]);
  }
  rows.push(["ER", ""]);
  return rows.map(([tag, value]) => `${tag}  - ${value}`).join("\n");
}

// The genre and the KEV format it belongs to (ANSI/NISO Z39.88-2004, the OpenURL standard's journal and book formats):
// `article` and `conference` are genres of the journal format; `bookitem` and `document` are genres of the book format.
/** @type {Record<string, { genre: string, book: boolean }>} */
const COINS_GENRES = {
  article: { genre: "article", book: false },
  review: { genre: "article", book: false },
  abstract: { genre: "conference", book: false },
  chapter: { genre: "bookitem", book: true },
  "teaching-resource": { genre: "document", book: true },
};

/**
 * One work as the `title` of a COinS span (ContextObject in Span, `<span class="Z3988" title="...">`), which Zotero and its
 * relatives read; the span stays empty. Key order is fixed so the output is a pure function of the values. One `rft.au` per
 * author, since a joined string reads as one author with a very long name; the DOI is `info:doi/` as OpenURL specifies. A
 * chapter is a `bookitem` and a teaching resource a `document`, both in the book format (`rft.atitle` and `rft.btitle`).
 *
 * @param {CitedWork} work
 * @param {CitationOptions} [options]
 * @returns {string}
 */
export function coinsTitle(work, options = {}) {
  const { genre, book } = COINS_GENRES[work.type ?? ""] ?? COINS_GENRES.article;
  /** @type {Array<[string, string]>} */
  const pairs = [
    ["ctx_ver", "Z39.88-2004"],
    ["rft_val_fmt", `info:ofi/fmt:kev:mtx:${book ? "book" : "journal"}`],
    ["rft.genre", genre],
  ];
  if (genre === "document") {
    pairs.push(["rft.btitle", decode(work.title)]);
  } else {
    pairs.push(["rft.atitle", decode(work.title)]);
    if (work.journal) pairs.push([book ? "rft.btitle" : "rft.jtitle", decode(work.journal)]);
  }
  if (work.year) pairs.push(["rft.date", String(work.year)]);
  if (work.volume) pairs.push(["rft.volume", String(work.volume)]);
  if (work.issue) pairs.push(["rft.issue", String(work.issue)]);
  if (work.firstPage) pairs.push(["rft.spage", work.firstPage]);
  if (work.lastPage) pairs.push(["rft.epage", work.lastPage]);
  for (const name of work.authors ?? []) pairs.push(["rft.au", authorOf(name, options)]);
  if (work.doi) pairs.push(["rft_id", `info:doi/${work.doi}`]);
  // encodeURIComponent, not URLSearchParams, which encodes a space as +, a literal plus here.
  return pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

/**
 * A separator swap, not a reformat, so a partial date stays partial instead of inventing a day.
 *
 * @param {string | null | undefined} isoish `YYYY-MM-DD`, `YYYY-MM` or `YYYY`
 * @param {number | null | undefined} year fallback when no date was deposited
 */
function scholarDate(isoish, year) {
  const value = (isoish ?? "").trim();
  if (/^\d{4}(-\d{2}){0,2}$/.test(value)) return value.replace(/-/g, "/");
  return year ? String(year) : null;
}

/** What Google Scholar needs on a page, or it skips the page entirely. */
export const REQUIRED_CITATION_TAGS = Object.freeze([
  "citation_title",
  "citation_author",
  "citation_publication_date",
]);

/**
 * The Highwire Press `citation_*` meta tags Google Scholar reads (https://scholar.google.com/intl/en/scholar/inclusion.html),
 * as meta descriptors. One `citation_author` per author: a joined tag reads as one person. A work missing a title, an author
 * or a date throws, since Scholar skips such a page, and a partial set would hide that. The PDF is named only when it is on
 * the site, since Scholar will not follow another host, and Scholar wants it in the abstract page's directory.
 *
 * @param {Pick<CitedWork, "title" | "authors" | "year" | "publishedDate" | "journal" | "volume" | "issue" | "firstPage" | "lastPage" | "doi">} work
 * @param {{ abstractUrl: string, pdfUrl?: string | null }} urls absolute URLs of this page and its hosted PDF
 * @returns {Array<{ name: string, content: string }>}
 */
export function citationTags(work, urls) {
  const title = decode(work.title).trim();
  const authors = (work.authors ?? []).map((name) => decode(name).trim()).filter(Boolean);
  const date = scholarDate(work.publishedDate, work.year);
  const missing = [];
  if (!title) missing.push("citation_title");
  if (authors.length === 0) missing.push("citation_author");
  if (!date) missing.push("citation_publication_date");
  if (missing.length > 0 || !date) {
    throw new Error(
      `citation tags: ${missing.join(", ")} would be empty for ${work.doi || "(no doi)"}. Google Scholar requires a title, at least one author and a date; a page without them is not indexed at all.`,
    );
  }
  /** @type {Array<{ name: string, content: string }>} */
  const tags = [{ name: "citation_title", content: title }];
  for (const name of authors) tags.push({ name: "citation_author", content: name });
  tags.push({ name: "citation_publication_date", content: date });
  const journal = decode(work.journal).trim();
  if (journal) tags.push({ name: "citation_journal_title", content: journal });
  if (work.volume) tags.push({ name: "citation_volume", content: String(work.volume) });
  if (work.issue) tags.push({ name: "citation_issue", content: String(work.issue) });
  if (work.firstPage) tags.push({ name: "citation_firstpage", content: work.firstPage });
  if (work.lastPage) tags.push({ name: "citation_lastpage", content: work.lastPage });
  if (work.doi) tags.push({ name: "citation_doi", content: work.doi });
  // Tells Scholar the PDF and this page are one record, not two.
  tags.push({ name: "citation_abstract_html_url", content: urls.abstractUrl });
  if (urls.pdfUrl) tags.push({ name: "citation_pdf_url", content: urls.pdfUrl });
  return tags;
}

/** A DOI as the registration agencies issue it (DOI Handbook 2.2): "10.", a registrant prefix of 4 to 9 digits, a slash, a suffix. */
export const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;

/**
 * A DOI as one lowercase URL segment ("10.1128/JVI.01234-19" is "10-1128-jvi-01234-19"): a page slug that stays the same for
 * the work's life, where its title may change.
 *
 * @param {string} doi
 * @returns {string}
 */
export function doiSlug(doi) {
  return String(doi ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
