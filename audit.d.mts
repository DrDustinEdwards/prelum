/**
 * @typedef {object} AuditPage
 * @property {string} url absolute
 * @property {number} status the HTTP status the crawl got
 * @property {string} [html] the body, for a 200
 * @property {string} [location] where a 3xx pointed
 * @property {boolean} [inSitemap]
 */
/**
 * @typedef {object} AuditFinding
 * @property {string} url
 * @property {string} check
 * @property {"error" | "warning"} severity error: search engines get it wrong; warning: worse results
 * @property {string} detail
 */
/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags` writes and
 * the links in the page, so it needs no HTML parser.
 *
 * @param {AuditPage[]} pages
 * @param {{ origin: string }} site
 * @returns {AuditFinding[]}
 */
export function auditPages(pages: AuditPage[], { origin }: {
    origin: string;
}): AuditFinding[];
export type AuditPage = {
    /**
     * absolute
     */
    url: string;
    /**
     * the HTTP status the crawl got
     */
    status: number;
    /**
     * the body, for a 200
     */
    html?: string | undefined;
    /**
     * where a 3xx pointed
     */
    location?: string | undefined;
    inSitemap?: boolean | undefined;
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
