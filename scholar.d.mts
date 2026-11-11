export type CitedWork = {
  /** the record's own id, used as the BibTeX key */
  id: string;
  title: string;
  authors: readonly string[];
  /** `article`, `review`, `abstract`, `chapter` or `teaching-resource`; anything else is an article */
  type?: string | undefined;
  /** the journal, or for a chapter the book */
  journal?: string | null | undefined;
  year?: number | null | undefined;
  /** `YYYY-MM-DD`, `YYYY-MM` or `YYYY` */
  publishedDate?: string | null | undefined;
  volume?: string | number | null | undefined;
  issue?: string | number | null | undefined;
  /** verbatim, since an article-number record has no first page */
  pages?: string | null | undefined;
  firstPage?: string | null | undefined;
  lastPage?: string | null | undefined;
  abstract?: string | null | undefined;
  /** as deposited, never lowercased */
  doi?: string | null | undefined;
};
export type CitationOptions = {
  /** a site's alias table, so one person's spellings export as one name */
  author?: ((name: string) => string) | undefined;
  /** terms BibTeX styles must not lowercase (a genus and species); group 1 is braced */
  protect?: RegExp | undefined;
};
/** One work as a BibTeX entry: entities decoded, special characters escaped, `protect` terms braced. */
export function toBibtex(work: CitedWork, options?: CitationOptions): string;
/** One work as a RIS record: `TY` first, `ER` last, authors as `Family, Given`. */
export function toRis(work: CitedWork, options?: CitationOptions): string;
/**
 * One work as the `title` of a COinS span (`<span class="Z3988" title="...">`), key order fixed. A chapter is a `bookitem`
 * and a teaching resource a `document`, both in OpenURL's book format.
 */
export function coinsTitle(work: CitedWork, options?: CitationOptions): string;
/** What Google Scholar needs on a page, or it skips the page. */
export const REQUIRED_CITATION_TAGS: readonly [
  "citation_title",
  "citation_author",
  "citation_publication_date",
];
/**
 * The Highwire Press `citation_*` meta tags Google Scholar reads, as meta descriptors. Throws when the title, an author or the
 * date is missing, since Scholar skips such a page.
 */
export function citationTags(
  work: Pick<
    CitedWork,
    | "title"
    | "authors"
    | "year"
    | "publishedDate"
    | "journal"
    | "volume"
    | "issue"
    | "firstPage"
    | "lastPage"
    | "doi"
  >,
  urls: { abstractUrl: string; pdfUrl?: string | null | undefined },
): Array<{ name: string; content: string }>;
