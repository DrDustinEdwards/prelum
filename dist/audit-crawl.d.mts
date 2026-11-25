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
export type AuditPage = import("./audit.mjs").AuditPage;
