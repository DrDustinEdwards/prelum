/**
 * The title, summary and intro of an llms.txt, for the llms-full.txt that repeats them: the `#` line, the `>` lines, and the
 * paragraphs before the first `##` section. A missing file gives the origin's host as the title.
 *
 * @param {string} text
 * @param {string} origin
 */
export function llmsHeaderOf(text: string, origin: string): {
    title: string;
    summary: string;
    intro: string[];
};
/**
 * Wraps a Worker's fetch handler so every page has a Markdown copy:
 *
 * - `/path.md` (and `/index.md` for the home page): the site's own answer when it has one, else the page at `/path`
 *   turned into Markdown with `htmlToMarkdown` and written by `markdownPage`, with `Link: rel="canonical"` to the page.
 * - A page asked for with `Accept: text/markdown` preferred (`prefersMarkdown`): the same copy, with `Vary: Accept`; a site
 *   that answers Markdown itself keeps its answer.
 * - Every other HTML page: as the site answers it, plus `Vary: Accept` and a `Link: rel="alternate"; type="text/markdown"`
 *   naming its copy, so an agent can find it.
 * - `/llms-full.txt`, where the site answers 404: the site's llms.txt title, summary and intro, then every page in its
 *   sitemap (`<sitemapindex>` followed one level) as `markdownPage` writes it, pages marked noindex left out. It is kept in
 *   the Cache API for the plain-text cache lifetime.
 *
 * The copy keeps the page's headers (its cache policy, the security headers) apart from those describing the HTML. A
 * redirect is followed within the site, up to twice. Only GET and HEAD are touched.
 *
 * @template {FetchHandler} F
 * @param {F} fetch
 * @param {MarkdownCopiesOptions} options
 * @returns {F}
 */
export function markdownCopies<F extends FetchHandler>(fetch: F, options: MarkdownCopiesOptions): F;
export { htmlToMarkdown } from "./markdown-html.mjs";
export type MarkdownCopy = {
    /**
     * the page's name: `og:title`, else `<title>`, else its first heading
     */
    title: string;
    /**
     * the meta description, or ""
     */
    description: string;
    /**
     * the canonical link, absolute
     */
    canonical: string | undefined;
    /**
     * the page asks search engines to leave it out
     */
    noindex: boolean;
    /**
     * the body of the page's `<main>` (or `<body>`) as Markdown, its headings from `##`
     */
    markdown: string;
};
/**
 * A Worker's fetch handler; `env` and `ctx` (its ExecutionContext) are passed through untouched, so a handler that reads
 * `ctx.exports` or `ctx.passThroughOnException` keeps its own types.
 */
export type FetchHandler = (request: Request, env?: any, ctx?: any) => Promise<Response> | Response;
export type MarkdownCopiesOptions = {
    /**
     * the site's production origin, for the canonical links and the llms-full.txt addresses
     */
    origin: string;
    /**
     * build /llms-full.txt from the sitemap when the site serves none, with at most this many
     * pages (200 by default); false leaves /llms-full.txt to the site
     */
    llmsFull?: number | false | undefined;
    /**
     * pages that get no Markdown copy, by path
     */
    skip?: ((path: string) => boolean) | undefined;
    /**
     * pages that get a copy but stay out of llms-full.txt, by path: a
     * catalog of records, say, which an agent fetches one at a time
     */
    llmsFullSkip?: ((path: string) => boolean) | undefined;
    /**
     * whether the site may answer a `.md` path itself (true by default, so it is asked first);
     * false when it answers none, so the copy is made without that first request, which a site that counts its 404s would count
     */
    siteMarkdown?: boolean | undefined;
};
