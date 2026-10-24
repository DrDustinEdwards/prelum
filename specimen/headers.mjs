// The specimen's page policy and Reporting-Endpoints, from site-runtime's builder: specimen/worker.mjs sends them on its own
// responses, and specimen/build.mjs writes them into dist/_headers for the static assets, which never run the Worker.
import { buildContentSecurityPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";

export const REPORT_PATH = "/csp-report";

/** Nothing unlisted, no forms, no inline script (the pages have none), and Cloudflare Web Analytics. */
export const PAGE_CSP = buildContentSecurityPolicy({
  denyUnlisted: true,
  noForms: true,
  sources: { img: ["data:"], connect: ["https://cloudflareinsights.com"] },
  styleAttributesInline: true,
  cloudflareWebAnalytics: true,
  extraDirectives: ["style-src-elem 'self'"],
  reportUri: REPORT_PATH,
  reportTo: "csp-endpoint",
}).value;

export const REPORTING_ENDPOINTS = reportingEndpoints("csp-endpoint", new URL(REPORT_PATH, "https://prelum.dustinedwards.info"));
