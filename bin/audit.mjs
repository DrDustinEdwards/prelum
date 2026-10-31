#!/usr/bin/env node
// prelum-audit: crawl a live site from its sitemap and run auditPages over every page, so a page that lost its title,
// description, canonical or structured data shows up the day it ships rather than when someone looks. `auditIcons` adds the
// site's favicon, touch icon and manifest.
//
//   prelum-audit --origin https://example.com [--from https://preview.example.workers.dev] [--max-pages 3000]
//
// --from fetches the pages from another host (a preview) while the canonicals are still checked against --origin.
// Each finding is printed as a GitHub annotation. Exits 1 when any finding is an error, so a scheduled job goes red, and 2
// when the site does not answer at all, so an outage is never read as findings.

import { parseArgs } from "node:util";

import { auditPages, crawlSite } from "../audit.mjs";
import { auditIcons } from "../icons.mjs";

const { values } = parseArgs({ options: { origin: { type: "string" }, from: { type: "string" }, "max-pages": { type: "string", default: "3000" } } });
if (!values.origin) {
  console.error("usage: prelum-audit --origin https://example.com [--from https://preview.example] [--max-pages 3000]");
  process.exit(2);
}
const origin = values.origin.replace(/\/$/, "");
const from = values.from?.replace(/\/$/, "");
/** @type {typeof fetch} */
const viaFrom = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return fetch(from && url.startsWith(origin) ? from + url.slice(origin.length) : url, init);
};
const fetcher = from ? viaFrom : fetch;

const home = await fetcher(`${origin}/`).catch((error) => error);
if (!(home instanceof Response) || home.status >= 500) {
  console.error(`prelum-audit: ${origin} did not answer: ${home instanceof Response ? home.status : home.message}`);
  process.exit(2);
}
const { pages, sitemap } = await crawlSite({ origin, fetch: fetcher, maxPages: Number(values["max-pages"]) });
const report = auditPages(pages, { origin, sitemap });
for (const finding of await auditIcons({ origin, fetch: fetcher })) {
  report.findings.push(finding);
  report.summary[finding.check] = (report.summary[finding.check] ?? 0) + 1;
}
for (const finding of report.findings) {
  console.log(`::${finding.severity} title=${finding.check}::${finding.url} ${finding.detail}`);
}
const errors = report.findings.filter((finding) => finding.severity === "error").length;
const counts = Object.entries(report.summary).map(([check, n]) => `${check} ${n}`).join(", ") || "no findings";
console.log(`prelum-audit: ${report.pages} pages on ${origin}; ${counts}.`);
process.exit(errors > 0 ? 1 : 0);
