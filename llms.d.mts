/**
 * @typedef {object} LlmsLink
 * @property {string} title
 * @property {string} url
 * @property {string} [description]
 */
/**
 * @typedef {object} LlmsLinkSection
 * @property {string} heading
 * @property {LlmsLink[]} links
 */
/**
 * @typedef {object} LlmsProseSection
 * @property {string} heading
 * @property {string[]} body paragraphs, kept as written and separated by a blank line
 */
/** @typedef {LlmsLinkSection | LlmsProseSection} LlmsSection */
/**
 * The llms.txt skeleton (llmstxt.org): title, a blockquote summary, optional intro paragraphs, then H2 sections of link lists.
 * A link's title is Markdown link text, so `[` and `]` are escaped and a line break in a title or description becomes a space; a
 * `)` in a URL is written `%29` so it cannot end the link. Everything else is kept as written, because the titles are prose and
 * the sites' own files carry quotes and ampersands in them. A section with no links is dropped rather than left a
 * bare heading. A prose section (`body` in place of `links`) is its heading, a blank line, then its paragraphs as written, for a
 * file that mixes prose with its lists; one with no paragraphs is dropped the same way.
 *
 * @param {{ title: string, summary: string, intro?: string[], sections: LlmsSection[] }} doc
 * @returns {string}
 */
export function llmsDocument(doc: {
    title: string;
    summary: string;
    intro?: string[];
    sections: LlmsSection[];
}): string;
/** @param {LlmsLink} link */
export function llmsLink(link: LlmsLink): string;
export type LlmsLink = {
    title: string;
    url: string;
    description?: string;
};
export type LlmsLinkSection = {
    heading: string;
    links: LlmsLink[];
};
export type LlmsProseSection = {
    heading: string;
    /**
     * paragraphs, kept as written and separated by a blank line
     */
    body: string[];
};
export type LlmsSection = LlmsLinkSection | LlmsProseSection;
