/**
 * A value as BibTeX text: entities decoded, then every special character escaped.
 *
 * @param {string | number | null | undefined} value
 */
export function escapeBibtex(value: string | number | null | undefined): string;
/**
 * A page range as BibTeX writes it: a hyphen or dash between two numbers becomes `--`, every one of them. An article
 * number or a single page is left as given.
 *
 * @param {string | number | null | undefined} value
 */
export function bibtexPages(value: string | number | null | undefined): string;
/**
 * One work as a BibTeX entry. Special characters are escaped after the entities are decoded, and `protect` braces a term
 * after escaping, or the braces would be escaped into visible punctuation. The DOI is as deposited, with a `url` at doi.org;
 * a work with no DOI has neither line, rather than a registry address that does not exist.
 *
 * @param {CitedWork} work
 * @param {CitationOptions} [options]
 * @returns {string}
 */
export function toBibtex(work: CitedWork, options?: CitationOptions): string;
/**
 * One work as a RIS record: `TY` first and `ER` last, tags as two letters, two spaces, a dash and a space. An author is
 * `Family, Given` from the last space of the (canonical) name.
 *
 * @param {CitedWork} work
 * @param {CitationOptions} [options]
 * @returns {string}
 */
export function toRis(work: CitedWork, options?: CitationOptions): string;
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
export function coinsTitle(work: CitedWork, options?: CitationOptions): string;
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
export function citationTags(work: Pick<CitedWork, "title" | "authors" | "year" | "publishedDate" | "journal" | "volume" | "issue" | "firstPage" | "lastPage" | "doi">, urls: {
    abstractUrl: string;
    pdfUrl?: string | null;
}): Array<{
    name: string;
    content: string;
}>;
/**
 * A DOI as one lowercase URL segment ("10.1128/JVI.01234-19" is "10-1128-jvi-01234-19"): a page slug that stays the same for
 * the work's life, where its title may change.
 *
 * @param {string} doi
 * @returns {string}
 */
export function doiSlug(doi: string): string;
/** What Google Scholar needs on a page, or it skips the page entirely. */
export const REQUIRED_CITATION_TAGS: readonly ["citation_title", "citation_author", "citation_publication_date"];
/** A DOI as the registration agencies issue it (DOI Handbook 2.2): "10.", a registrant prefix of 4 to 9 digits, a slash, a suffix. */
export const DOI_PATTERN: RegExp;
export type CitedWork = {
    /**
     * the record's own id, used as the BibTeX key: a second key scheme would give one work two identities
     */
    id: string;
    title: string;
    authors: readonly string[];
    /**
     * `article`, `review`, `abstract`, `chapter` or `teaching-resource`; anything else is an article
     */
    type?: string | undefined;
    /**
     * the journal, or for a chapter the book
     */
    journal?: string | null | undefined;
    year?: number | null | undefined;
    /**
     * `YYYY-MM-DD`, `YYYY-MM` or `YYYY`
     */
    publishedDate?: string | null | undefined;
    volume?: string | number | null | undefined;
    issue?: string | number | null | undefined;
    /**
     * verbatim, as an article-number record has no first page
     */
    pages?: string | null | undefined;
    firstPage?: string | null | undefined;
    lastPage?: string | null | undefined;
    abstract?: string | null | undefined;
    /**
     * as deposited, never lowercased
     */
    doi?: string | null | undefined;
};
export type CitationOptions = {
    /**
     * a site's alias table, so one person's spellings export as one name
     */
    author?: ((name: string) => string) | undefined;
    /**
     * terms BibTeX styles must not lowercase (a genus and species); group 1 is braced
     */
    protect?: RegExp | undefined;
};
