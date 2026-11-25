#!/usr/bin/env node
// prelum-chart-audit: crawl a live site the way prelum-audit does (its sitemap, then the same-origin pages those pages link to) and
// check every chart on every page against the charts checklist (area 10, section G), in a headless browser, with scripts off
// and in the light and dark color schemes.
//
//   prelum-chart-audit --origin https://example.com [--from https://preview.example.workers.dev] [--max-pages 1500]
//               [--chart-kb 100] [--no-strict-frame] [--pages <file | comma list>] [--start <url>]...
//
// A chart is an Enarratio figure or piece (`.enarratio[data-enarratio]`), or the Capsomer frame it sits in (`.cap-chart`, Capsomer 0.53).
// Each finding is a GitHub annotation titled with its checklist item, its proof the page's URL:
//
//   B2   with scripts off there is no SVG, or the chart is drawn only by script
//   B18  no visible title, finding sentence or caption, with scripts off
//   B30  no data table, with scripts off
//   B28  the SVG is not role="img" (or, enhanced, role="group" with aria-roledescription="chart") with an accessible name;
//        the table has no th, a th without scope, or no caption
//   B1   chart text under 4.5:1, or a mark or legend swatch under 3:1, against what is painted behind it (light and dark)
//   B3   chart text drawn under 12 px at the default zoom
//   B27  axe-core (WCAG 2.2 A and AA) reports a violation inside the chart (light and dark)
//   D6   the chart's drawing (its inline SVG, as shown) is over --chart-kb; the data table and a phone drawing waiting in
//        the frame's redraw spec are not counted, since the table is the chart's text equivalent and only one drawing shows
//   F    the page loads another chart library, or draws an SVG chart outside Enarratio; the chart is not in the frame
//   D5   with scripts on, at 1280 and at 320 px, a chart moves by 0.01 or more in layout shifts with no recent input. A shift
//        counts only while what it moves is on screen, so the first chart is held at the top as the page loads, each chart is
//        scrolled to, and one that resized out of sight is held in view in a load of its own (up to 3 more); a fold the check
//        opens itself is not counted
//   C1   no CSV link; C2 no source line
//   C12  at 320 px wide (scripts on, the page scrolled through), the drawing overflows its frame sideways (a table chart, a data
//        table, may scroll: WCAG 1.4.10's two-dimensional exception), or chart text is drawn under 12 px
//
// An inline primitive (Enarratio's `inline: true`: a bare sparkline, heat strip, progress ring, uptime strip or timeline in a stat
// tile or a table row, outside any figure) needs no frame, title, caption, CSV or table. It passes when it is role="img" with a
// name that states its values or finding, or when it is aria-hidden beside visible text that gives the numbers; else B18.
//
// C1, C2 and the frame are errors; --no-strict-frame makes them warnings.
// --pages adds pages to the crawl (a file of URLs or paths, one per line, or a comma list), for charts no link reaches, a query
// included (/x?tab=a, for a chart behind a tab); each --start URL is opened first in every browser context, so a demo route that
// sets a session cookie opens the pages behind it. A page the browser could not open is titled G: an error when it answers 200
// with an empty body or lands on a sign-in page (its charts were never read), a warning otherwise. Exits 0 with no errors, 1 with
// any, and 2 when it could not run: the site or its sitemap does not answer, no page opened, or no browser started.
//
// Needs playwright-core and axe-core (optional peers); when they are not installed it installs the pinned versions into a
// cache directory once, so the scoreboard's bare install can run it. It drives Playwright's Chromium when installed, else
// the system Chrome, else the browser at CHART_AUDIT_CHROME.

import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { annotation } from "../annotation.mjs";
import { crawlSite } from "../audit.mjs";
import { NARROW, launch, loadTools, newContext } from "./chart-audit-browser.mjs";
import { createAuditor } from "./chart-audit-run.mjs";

/** @typedef {import("./chart-audit-run.mjs").Finding} Finding */

const PARALLEL = 4;

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    from: { type: "string" },
    "max-pages": { type: "string", default: "1500" },
    "chart-kb": { type: "string", default: "100" },
    "no-strict-frame": { type: "boolean", default: false },
    pages: { type: "string" },
    start: { type: "string", multiple: true, default: [] },
  },
});
if (!values.origin) {
  console.error(
    "usage: prelum-chart-audit --origin https://example.com [--from https://preview.example] [--max-pages 1500] [--chart-kb 100] [--no-strict-frame] [--pages <file | a,b>] [--start <url>]...",
  );
  process.exit(2);
}
const origin = values.origin.replace(/\/$/, "");
const from = values.from?.replace(/\/$/, "");
const served = (/** @type {string} */ url) =>
  from && url.startsWith(origin) ? from + url.slice(origin.length) : url;
/** @type {typeof fetch} */
const fetcher = (input, init) =>
  fetch(
    served(typeof input === "string" ? input : input instanceof URL ? input.href : input.url),
    init,
  );
const budget = Number(values["chart-kb"]) * 1024;
const frameSeverity = values["no-strict-frame"] ? "warning" : "error";
const at = (/** @type {string} */ ref) => new URL(ref, `${origin}/`).href;
/** @type {string[]} */
const extra = values.pages
  ? (existsSync(values.pages)
      ? readFileSync(values.pages, "utf8").split(/\r?\n/)
      : values.pages.split(",")
    )
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(at)
  : [];
const starts = (values.start ?? []).map(at);

const home = await fetcher(`${origin}/`).catch((error) => error);
if (!(home instanceof Response) || home.status >= 500) {
  console.error(
    `prelum-chart-audit: ${origin} did not answer: ${home instanceof Response ? home.status : home.message}`,
  );
  process.exit(2);
}
const { pages, sitemap } = await crawlSite({
  origin,
  fetch: fetcher,
  maxPages: Number(values["max-pages"]),
});
if (sitemap.length === 0 && extra.length === 0) {
  console.error(
    `prelum-chart-audit: ${origin}/sitemap.xml lists no pages, or did not load, so there is nothing to crawl`,
  );
  process.exit(2);
}
// One URL per path: a filter link (`/?year=2024`) draws the page's charts again, so it would only repeat their findings. A
// redirect the crawl stopped at is followed to its target, and a same-origin iframe a page shows (a component's
// examples) is opened as a page of its own.
/** @type {string[]} */
const queue = [];
const paths = new Set();
// A named page keeps its query in the key, so /x?tab=a and /x?tab=b are both read (charts behind a tab); a crawled link
// is keyed by its path alone, so filters and sorts never multiply the crawl.
const enqueue = (/** @type {string} */ url, named = false) => {
  const parsed = new URL(url);
  const path =
    parsed.pathname.replace(/(\/index)?(\.html)?\/?$/, "") + (named ? parsed.search : "");
  if (parsed.origin !== origin || paths.has(path) || paths.size >= Number(values["max-pages"]))
    return;
  paths.add(path);
  queue.push(parsed.href);
};
// The named pages first, so --max-pages never drops them.
for (const url of extra) enqueue(url, true);
for (const page of pages) {
  if (
    page.status === 200 &&
    (page.html !== undefined ||
      /html/i.test(
        String(/** @type {Record<string, string>} */ (page.headers ?? {})["content-type"] ?? ""),
      ))
  )
    enqueue(page.url);
  else if (page.status >= 300 && page.status < 400 && page.location)
    enqueue(new URL(page.location, page.url).href);
}

let browser;
/** @type {string} */
let axeSource;
try {
  const tools = await loadTools();
  axeSource = tools.axeSource;
  browser = await launch(tools.chromium);
} catch (error) {
  console.error(
    `prelum-chart-audit: could not start a browser: ${error instanceof Error ? error.message : error}`,
  );
  process.exit(2);
}
const contexts = {
  off: await newContext(browser, "light", false),
  light: await newContext(browser, "light", true),
  dark: await newContext(browser, "dark", true),
  narrow: await newContext(browser, "light", true, NARROW),
};
// A start URL sets what the pages behind it need (a demo session cookie) in each context, before any page is read.
for (const url of starts) {
  for (const context of Object.values(contexts)) {
    const page = await context.newPage();
    try {
      const response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
      if (!response || response.status() >= 400)
        throw new Error(`answered ${response?.status() ?? "nothing"}`);
    } catch (error) {
      console.error(
        `prelum-chart-audit: the start URL ${url} did not open: ${String(error instanceof Error ? error.message : error).split("\n")[0]}`,
      );
      process.exit(2);
    } finally {
      await page.close();
    }
  }
}

/** @type {Finding[]} */
const findings = [];
const scripts = new Map();
const auditPage = createAuditor({
  origin,
  from,
  served,
  budget,
  budgetKb: values["chart-kb"],
  frameSeverity,
  contexts,
  scripts,
  axeSource,
  enqueue,
});
let opened = 0;
let withCharts = 0;
let charts = 0;
let busy = 0;
await Promise.all(
  Array.from({ length: PARALLEL }, async () => {
    while (queue.length > 0 || busy > 0) {
      const url = queue.shift();
      if (!url) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }
      busy++;
      try {
        const found = await auditPage(url);
        opened++;
        if (found.charts > 0) withCharts++;
        charts += found.charts;
        findings.push(...found.findings);
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error).split("\n")[0];
        // An empty page is broken for every reader, so it fails; a timeout or a refused load may be this run's alone, so
        // its charts are not measured: never a warning that passes.
        // A sign-in wall hides every chart on the page from the check, so it fails too: a false "no charts" is a false pass.
        const broken =
          message.startsWith("answered 200 with an empty body") ||
          message.startsWith("redirected to sign-in");
        // Such a page did open, so a run whose every page is behind sign-in fails with the G error, not "could not run".
        if (broken) opened++;
        findings.push({
          severity: broken ? "error" : "unmeasured",
          item: "G",
          url,
          detail: `the browser could not open it: ${message}`,
        });
      } finally {
        busy--;
      }
    }
  }),
);
await browser.close();
if (opened === 0) {
  console.error(
    `prelum-chart-audit: none of the ${paths.size} pages on ${origin} opened in the browser`,
  );
  process.exit(2);
}

const seen = new Set();
const unique = findings.filter((f) => {
  const key = `${f.severity} ${f.item} ${f.url} ${f.detail}`;
  return !seen.has(key) && seen.add(key);
});
unique.sort(
  (a, b) => a.url.localeCompare(b.url) || a.item.localeCompare(b.item, "en", { numeric: true }),
);
for (const f of unique) {
  console.log(
    f.severity === "unmeasured"
      ? annotation("notice", f.item, `${f.url} could not measure: ${f.detail}`)
      : annotation(f.severity, f.item, `${f.url} ${f.detail}`),
  );
}
/** @type {Record<string, number>} */
const summary = {};
for (const f of unique) summary[f.item] = (summary[f.item] ?? 0) + 1;
const counts =
  Object.entries(summary)
    .map(([item, n]) => `${item} ${n}`)
    .join(", ") || "no findings";
console.log(
  `prelum-chart-audit: ${opened} pages on ${origin}, ${charts} charts on ${withCharts} of them; ${counts}.`,
);
process.exit(
  unique.some((f) => f.severity === "error")
    ? 1
    : unique.some((f) => f.severity === "unmeasured")
      ? 3
      : 0,
);
