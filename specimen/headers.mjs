// The specimen's security headers, page policy and Reporting-Endpoints, from site-runtime's builders: specimen/worker.mjs sends them on its own
// responses, and specimen/build.mjs writes HEADERS_FILE into dist/_headers for the static assets, which the Worker hands on untouched.
import { buildContentSecurityPolicy, buildPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import { buildSecurityHeaders, headersFile } from "@dustinedwards/site-runtime/headers";

export const REPORT_PATH = "/csp-report";

/**
 * Nothing unlisted, no forms, no inline script (the pages have none), and Cloudflare Web Analytics. The beacon is injected by
 * the edge (automatic setup) and reports to this origin's /cdn-cgi/rum, which connect-src's 'self' covers.
 */
export const PAGE_CSP = buildContentSecurityPolicy({
  denyUnlisted: true,
  noForms: true,
  sources: { img: ["data:"] },
  styleAttributesInline: true,
  cloudflareWebAnalytics: true,
  reportUri: REPORT_PATH,
  reportTo: "csp-endpoint",
}).value;

export const REPORTING_ENDPOINTS = reportingEndpoints("csp-endpoint", new URL(REPORT_PATH, "https://prelum.dustinedwards.info"));

/** Every security header the specimen sends: site-runtime's standard set with the page policy and its report endpoint. */
export const SITE_HEADERS = Object.freeze({
  ...buildSecurityHeaders(),
  "Content-Security-Policy": PAGE_CSP,
  "Reporting-Endpoints": REPORTING_ENDPOINTS,
});

/**
 * A Mermaid drawing styles itself with an inline <style>, which the page policy refuses when the SVG is opened on its own. The
 * builder writes 'self' for script, font and image on every policy, so this one is the plain join: nothing but its own style.
 */
const DIAGRAM_CSP = buildPolicy([
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  `report-uri ${REPORT_PATH}`,
  "report-to csp-endpoint",
]);

const CSP = "Content-Security-Policy";

/**
 * dist/_headers, from site-runtime's headersFile: the set on every path, the page policy as its own `/*` rule (headersFile keeps
 * policies out of the set's block), and the diagrams' policy in place of it. headersFile detaches only the set's own headers, so
 * the `! Content-Security-Policy` that keeps the page policy off a diagram is written in here.
 */
const { [CSP]: page, ...set } = SITE_HEADERS;
export const HEADERS_FILE = headersFile(set, {
  paths: {
    "/*": { [CSP]: page, "Cache-Control": "public, max-age=300, must-revalidate" },
    "/elements.json": { "Access-Control-Allow-Origin": "*" },
    "/diagrams/*": { [CSP]: DIAGRAM_CSP },
  },
}).replace("/diagrams/*\n", `/diagrams/*\n  ! ${CSP}\n`);
