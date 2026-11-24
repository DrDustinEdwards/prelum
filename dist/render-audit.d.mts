/**
 * Findings for every 200 HTML page the crawl fetched. `check` names the checklist item; errors are what a reader gets wrong (a link to
 * nowhere, an image with no text alternative), warnings what reads worse.
 *
 * @param {AuditPage[]} pages
 * @param {{ renderVersion?: string }} [options] the version stored HTML must carry; this Prelum's RENDER_VERSION by default
 * @returns {AuditFinding[]}
 */
export function auditContent(pages: AuditPage[], { renderVersion }?: {
    renderVersion?: string;
}): AuditFinding[];
export type AuditPage = import("./audit.mjs").AuditPage;
export type AuditFinding = import("./audit.mjs").AuditFinding;
