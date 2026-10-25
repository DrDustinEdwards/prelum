/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * `crawlSite`, Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags`
 * writes and the links in the page, so it needs no HTML parser. Pure: it fetches nothing.
 *
 * @param site `origin` is the production origin every canonical must be on; `sitemap` the URLs the sitemap lists (a page's
 *   own `inSitemap` counts too), and an empty list is itself a finding
 */
export function auditPages(pages: AuditPage[], { origin, sitemap }: {
    origin: string;
    sitemap?: string[] | undefined;
}): AuditReport;
/**
 * Fetch a site the way an audit crawler does, for `auditPages`: every sitemap URL with `redirect: "manual"`, following up to
 * five redirects itself so each hop is a page and a chain shows; then, status only (HEAD, or GET where HEAD is refused), each
 * same-origin link target those pages name that the sitemap did not. Sequential, and never throws: a fetch that fails is a
 * page with status 0 and its error. A browser's fetch hides a manual redirect's status, so run it in a Worker or Node.
 */
export function crawlSite(input: CrawlInput): Promise<{
    pages: AuditPage[];
    sitemap: string[];
}>;
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
     * error: search engines get it wrong; warning: worse results
     */
    severity: "error" | "warning";
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
