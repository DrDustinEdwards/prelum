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
/**
 * One page as Markdown: its title as the `#` heading, the description as a blockquote, the page's URL, then the body. The
 * same text is the page's `.md` copy and its part of llms-full.txt, so the two cannot disagree. A line break in the title or
 * description becomes a space, so neither can end its line early.
 *
 * @param {LlmsPage} page
 * @returns {string}
 */
export function markdownPage(page: LlmsPage): string;
/**
 * llms-full.txt (llmstxt.org): the same title, summary and intro as llms.txt, then every page in full, each as `markdownPage`
 * writes it. Pages keep the caller's order, so the file is byte for byte the same on every build of the same pages.
 *
 * @param {{ title: string, summary: string, intro?: string[], pages: LlmsPage[] }} doc
 * @returns {string}
 */
export function llmsFullDocument(doc: {
    title: string;
    summary: string;
    intro?: string[];
    pages: LlmsPage[];
}): string;
/**
 * Where a page's Markdown copy lives: `/writing/post` is `/writing/post.md`, and the home page is `/index.md`.
 *
 * @param {string} path
 */
export function markdownPath(path: string): string;
/**
 * Whether a request's Accept header prefers Markdown over HTML (RFC 9110). Markdown wins only when `text/markdown` is
 * acceptable and outranks every HTML and wildcard range; a tie or an unreadable header keeps HTML, so a browser never gets
 * Markdown by accident. Cloudflare Nimbus's `prefersMarkdown` (MIT, Copyright (c) 2025 Cloudflare, Inc.).
 *
 * @param {string | null | undefined} accept
 * @returns {boolean}
 */
export function prefersMarkdown(accept: string | null | undefined): boolean;
/**
 * The response for a page's Markdown copy, from its `.md` route or from the page's own route when `prefersMarkdown` is true.
 * `Vary: Accept` tells a cache the page's URL has two forms; the page's HTML response needs it too. With `canonical`, a
 * `Link: rel="canonical"` header points search engines at the HTML page, so the copy never competes with it.
 *
 * @param {string} markdown what `markdownPage` wrote
 * @param {{ canonical?: string, headers?: Record<string, string> }} [options] `headers` are added, e.g. the site's cache policy
 * @returns {Response}
 */
export function markdownResponse(markdown: string, options?: {
    canonical?: string;
    headers?: Record<string, string>;
}): Response;
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
export type LlmsPage = {
    title: string;
    /**
     * the page's absolute URL
     */
    url: string;
    description?: string;
    /**
     * the page's body as Markdown, frontmatter already stripped; its headings start at `##`
     */
    markdown: string;
};
