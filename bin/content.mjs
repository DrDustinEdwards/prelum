#!/usr/bin/env node
// prelum-content: the live check for writing. Crawls a deployed site's sitemap and reports what render-audit.mjs finds, one GitHub
// annotation per finding, for the family's daily run.
//
//   prelum-content --origin https://example.com [--from https://example.workers.dev] [--max 200]
//
// --from fetches from another host (a workers.dev address before a domain moves) while links are judged against --origin. Exits 0
// when clean, 1 on an error finding, 2 when it could not run.

import { parseArgs } from "node:util";

import { crawlSite } from "../audit.mjs";
import { auditContent } from "../render-audit.mjs";

const { values } = parseArgs({ options: { origin: { type: "string" }, from: { type: "string" }, max: { type: "string", default: "200" } } });
if (!values.origin) {
  console.error("usage: prelum-content --origin https://example.com [--from https://example.workers.dev] [--max 200]");
  process.exit(2);
}
const origin = new URL(values.origin).origin;
const from = values.from ? new URL(values.from).origin : origin;

/** @type {typeof fetch} */
const fetcher = (input, init) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.origin === origin) url.href = from + url.pathname + url.search;
  return fetch(url, init);
};

const { pages } = await crawlSite({ origin, fetch: fetcher, maxPages: Number(values.max) });
const read = pages.filter((page) => page.html !== undefined);
if (read.length === 0) {
  console.error(`prelum-content: no page of ${origin} could be read from its sitemap`);
  process.exit(2);
}
const findings = auditContent(read);
for (const f of findings) console.log(`::${f.severity} title=${f.check}::${f.url} ${f.detail}`);
const errors = findings.filter((f) => f.severity === "error").length;
console.log(`prelum-content: ${read.length} pages, ${errors} errors, ${findings.length - errors} warnings`);
process.exit(errors > 0 ? 1 : 0);
