#!/usr/bin/env node
// prelum-indexnow: after a static site deploys, tell IndexNow which pages changed, from the built sitemap.
//
//   prelum-indexnow --origin https://example.com --key <key> --sitemap dist/sitemap.xml [--days 2]
//
// The pages whose <lastmod> is within --days go (every page when the sitemap has none). The site serves its key as
// /<key>.txt, a static file whose whole body is the key. Never fails the deploy: a refused or failed submission is a
// warning, since a missed ping only means the engines find the pages on their own schedule.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { recentSitemapUrls, submitIndexNow } from "../indexnow.mjs";

const { values } = parseArgs({ options: { origin: { type: "string" }, key: { type: "string" }, sitemap: { type: "string" }, days: { type: "string", default: "2" } } });
if (!values.origin || !values.key || !values.sitemap) {
  console.error("usage: prelum-indexnow --origin https://example.com --key <key> --sitemap dist/sitemap.xml [--days 2]");
  process.exit(2);
}
const origin = values.origin.replace(/\/$/, "");
const urls = recentSitemapUrls(readFileSync(values.sitemap, "utf8"), { days: Number(values.days) });
if (urls.length === 0) console.log("prelum-indexnow: no page changed; nothing sent.");
else if (await submitIndexNow({ origin, key: values.key, urls })) console.log(`prelum-indexnow: sent ${urls.length} URL(s) to IndexNow.`);
else console.log(`::warning::prelum-indexnow: IndexNow did not take the ${urls.length} URL(s); the engines will crawl them on their own schedule.`);
