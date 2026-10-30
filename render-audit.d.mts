/**
 * Findings for every 200 HTML page a crawl fetched: one h1, heading order, unique ids, in-page links that land, image alt text and
 * size, leaked markdown, and stored HTML at the current render version (`data-render-version` on its wrapper).
 */
export function auditContent(
    pages: import("./audit.mjs").AuditPage[],
    options?: { renderVersion?: string },
): import("./audit.mjs").AuditFinding[];
