// The specimen's Worker: site-runtime's staticSite, the one front door the family's static sites share, with the specimen's
// headers from its registry entry (@dustinedwards/site-runtime/sites, prelum) and the TDMRep header on top. One hop from
// plain HTTP to HTTPS; Content-Security-Policy, Integrity-Policy and COEP reports at /csp-report with site-runtime's shared
// receiver (logged to Workers Logs, nothing stored, limited by CSP_REPORT_RATE_LIMIT); the prefetch rules at
// /speculation-rules.json; and every page with the Speculation-Rules, Server-Timing and preload Link headers (Early
// Hints). A path with no file gets the 404 page, private and never stored, and so does a page asked for with a cookie.
// wrangler.jsonc runs it first for every path but the fonts, KaTeX, images and diagrams, which the asset server answers
// with the `_headers` rules `npm run specimen` writes from the same entry (site-runtime-headers). site-runtime is a
// devDependency: the published library never imports this file. Prelum's serveMarkdownCopies wraps it, so the page's
// Markdown copy answers.

import { preloads } from "@dustinedwards/site-runtime/preload";
import { prelum } from "@dustinedwards/site-runtime/sites";
import { staticSite } from "@dustinedwards/site-runtime/static-site";
import { serveMarkdownCopies } from "../llms.mjs";
import { TDM_RESERVATION_HEADERS } from "../robots.mjs";

/**
 * What every page blocks on or paints first, sent as a preload Link (and so as Early Hints): the one stylesheet, the
 * headings' Schibsted Grotesk and the prose's Source Serif 4. specimen/build.mjs refuses a build that lacks one of them.
 */
export const PAGE_PRELOADS = preloads([
  { href: "/site.css", as: "style" },
  { href: "/fonts/schibsted-grotesk-latin-wght-normal.woff2", as: "font", type: "font/woff2" },
  { href: "/fonts/source-serif-4-latin-wght-normal.woff2", as: "font", type: "font/woff2" },
]);

const site = staticSite({ site: prelum, headers: TDM_RESERVATION_HEADERS, preload: PAGE_PRELOADS.header });

// The page's Markdown copy (/index.md, or Accept: text/markdown), which `npm run specimen` writes with prelum-markdown
// beside llms-full.txt.
export default { fetch: serveMarkdownCopies(site.fetch, { origin: prelum.origin }) };
