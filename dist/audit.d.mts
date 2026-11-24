/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * `crawlSite`, Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags`
 * writes and the links in the page, so it needs no HTML parser. Pure: it fetches nothing.
 *
 * @param {AuditPage[]} pages
 * @param {{ origin: string, sitemap?: string[], robots?: string | null, lastmods?: Record<string, string | null>, preview?: boolean }} site `origin` is the production origin every canonical
 *   must be on; `sitemap` the URLs the sitemap lists (a page's own `inSitemap` counts too), and an empty list is itself a
 *   finding; `robots` the text of `/robots.txt` (`crawlSite` returns it, null when it did not load), left out to skip the
 *   robots checks; `lastmods` the sitemap's `lastmod` per URL (null for none), which `crawlSite` returns, left out to skip the
 *   lastmod checks; `preview` marks pages served from a workers.dev address, whose robots.txt and X-Robots-Tag keep the preview
 *   out of search on purpose, so neither is held against the site; a noindex meta still is
 * @returns {AuditReport}
 */
export function auditPages(pages: AuditPage[], { origin, sitemap, robots: robotsText, lastmods, preview }: {
    origin: string;
    sitemap?: string[];
    robots?: string | null;
    lastmods?: Record<string, string | null>;
    preview?: boolean;
}): AuditReport;
/**
 * @typedef {object} CrawlInput
 * @property {string} origin the production origin; only its URLs are fetched
 * @property {typeof fetch} fetch every request goes through it, so a scheduled job can pass its own (and a test a fake)
 * @property {number} [maxPages] the most pages fetched in all, redirect hops and link checks included (200)
 * @property {string} [sitemapPath] where the sitemap is (`/sitemap.xml`); a sitemap index is followed one level
 */
/**
 * Fetch a site the way an audit crawler does, for `auditPages`: every sitemap URL with `redirect: "manual"`, following up to
 * five redirects itself so each hop is a page and a chain shows; then each same-origin link target those pages name that
 * the sitemap did not, its HTML kept so `auditPages` can tell an indexable page the sitemap left out. Sequential, and never throws: a fetch that fails is a
 * page with status 0 and its error. A browser's fetch hides a manual redirect's status, so run it in a Worker or Node.
 *
 * @param {CrawlInput} input
 * @returns {Promise<{ pages: AuditPage[], sitemap: string[], robots: string | null, lastmods: Record<string, string | null> }>}
 *   `robots` is `/robots.txt`'s text, null when it did not load as text; `lastmods` each sitemap URL's `lastmod` (null for
 *   none); pass both to `auditPages`
 */
export function crawlSite({ origin, fetch: fetcher, maxPages, sitemapPath, }: CrawlInput): Promise<{
    pages: AuditPage[];
    sitemap: string[];
    robots: string | null;
    lastmods: Record<string, string | null>;
}>;
export type CrawlInput = {
    /**
     * the production origin; only its URLs are fetched
     */
    origin: string;
    /**
     * every request goes through it, so a scheduled job can pass its own (and a test a fake)
     */
    fetch: typeof fetch;
    /**
     * the most pages fetched in all, redirect hops and link checks included (200)
     */
    maxPages?: number | undefined;
    /**
     * where the sitemap is (`/sitemap.xml`); a sitemap index is followed one level
     */
    sitemapPath?: string | undefined;
};
export type Rule = {
    allow: boolean;
    path: string;
};
export type Group = Rule[];
export type AuditPage = {
    /**
     * absolute
     */
    url: string;
    /**
     * the HTTP status the crawl got; 0 when the fetch itself failed
     */
    status: number;
    /**
     * the response headers (`X-Robots-Tag` is read from them)
     */
    headers?: Record<string, string> | Headers | undefined;
    /**
     * the body, for a 200 HTML page; a page without one gets no head checks
     */
    html?: string | undefined;
    /**
     * where a 3xx pointed
     */
    location?: string | undefined;
    /**
     * the URLs that redirected to this one, first to last
     */
    redirectedFrom?: string[] | undefined;
    inSitemap?: boolean | undefined;
    /**
     * why the fetch failed, for status 0
     */
    error?: string | undefined;
};
export type AuditFinding = {
    url: string;
    check: string;
    /**
     * error: search engines get it wrong; warning: worse results;
     * unmeasured: the page could not be read, so nothing about it was measured (never a pass or a failure)
     */
    severity: "error" | "warning" | "unmeasured";
    detail: string;
};
export type AuditReport = {
    findings: AuditFinding[];
    /**
     * how many pages were audited
     */
    pages: number;
    /**
     * findings per check
     */
    summary: Record<string, number>;
};
