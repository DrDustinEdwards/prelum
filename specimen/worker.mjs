// The specimen's Worker: site-runtime's staticSite, the one front door the family's static sites share. One hop from
// plain HTTP to HTTPS; Content-Security-Policy violation reports at /csp-report with site-runtime's shared receiver
// (logged to Workers Logs, nothing stored, limited by CSP_REPORT_RATE_LIMIT); the prefetch rules at
// /speculation-rules.json; and every page with the Speculation-Rules, Server-Timing and preload Link headers (Early
// Hints) and the security set from specimen/headers.mjs. A path with no file gets the 404 page, private and never
// stored, and so does a page asked for with a cookie. wrangler.jsonc runs it first for every path but the fonts,
// KaTeX, images and diagrams, which the asset server answers with their `_headers` rules. site-runtime is a
// devDependency: the published library never imports this file.

import { staticSite } from "@dustinedwards/site-runtime/static-site";
import { PAGE_PRELOADS, REPORT_PATH, SITE_HEADERS } from "./headers.mjs";

export default staticSite({ headers: SITE_HEADERS, preload: PAGE_PRELOADS.header, reportPath: REPORT_PATH });
