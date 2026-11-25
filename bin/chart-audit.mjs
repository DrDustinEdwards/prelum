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

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { annotation } from "../annotation.mjs";
import { crawlSite } from "../audit.mjs";
import {
  hasChart,
  openFolds,
  pinChart,
  quietShifts,
  readStrays,
  readShifts,
  scrollThrough,
  settle,
  stopPin,
  visitCharts,
  watchShifts,
} from "./chart-audit-page.mjs";
import { readCharts } from "./chart-audit-read.mjs";

/** @typedef {import("playwright-core").Browser} Browser */
/** @typedef {import("playwright-core").BrowserContext} BrowserContext */
/** @typedef {{ severity: "error" | "warning" | "unmeasured", item: string, url: string, detail: string }} Finding */

const LIBRARIES = /** @type {const} */ ([
  // name, DOM container, a string only that library's code carries, and the page global it sets
  [
    "Recharts",
    ".recharts-wrapper, .recharts-surface",
    /recharts-(?:wrapper|surface|cartesian)/,
    null,
  ],
  ["Chart.js", null, /Chart\.js v\d|chartjs-(?:render|size)/, "Chart"],
  ["ApexCharts", ".apexcharts-canvas", /apexcharts-canvas/, "ApexCharts"],
  ["ECharts", "[_echarts_instance_]", /_echarts_instance_/, "echarts"],
  ["Highcharts", ".highcharts-container", /highcharts-container/, "Highcharts"],
  ["Plotly", ".js-plotly-plot", /js-plotly-plot|plotly\.js v\d/, "Plotly"],
  ["Nivo", "[class*='nivo']", /@nivo\/(?:core|bar|line|pie)/, null],
  ["visx", "[class*='visx-']", /visx-(?:group|axis|bar|linepath|area)/, null],
]);
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
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
// D5: chart layout shift at or over this is an error. The checklist asks for 0; under 0.01 is sub-pixel rounding.
const D5_LIMIT = 0.01;
// The narrow pass: a phone in portrait, the width WCAG 1.4.10 (reflow) names.
const NARROW = 320;
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

/**
 * One page: with scripts on in light first, and only when that finds a chart, a chart library or a drawn SVG, again with
 * scripts off and in dark.
 * @param {string} url
 * @returns {Promise<{ charts: number, findings: Finding[] }>}
 */
async function auditPage(url) {
  const light = await visit(contexts.light, url, true);
  for (const frame of light.frames)
    enqueue(from && frame.startsWith(from) ? origin + frame.slice(from.length) : frame);
  const libraries = new Set([...light.libraries, ...(await scriptLibraries(light.scripts))]);
  if (light.units.length === 0 && light.drawn.length === 0 && libraries.size === 0)
    return { charts: 0, findings: [] };
  const off = await visit(contexts.off, url, false);
  const dark = await visit(contexts.dark, url, true);
  const narrow = await visit(contexts.narrow, url, true, true);
  /** @type {Finding[]} */
  const out = [];
  const add = (
    /** @type {"error" | "warning"} */ severity,
    /** @type {string} */ item,
    /** @type {string} */ detail,
  ) => out.push({ severity, item, url, detail });

  for (const unit of off.units) {
    const name = `${unit.label} (${unit.kind})`;
    if (unit.inline) {
      // An inline primitive carries its own words, or sits beside the words that carry its numbers.
      if (!unit.inline.ok)
        add(
          "error",
          "B18",
          `${name}: an inline primitive whose ${unit.inline.hidden ? "visible neighbor gives no numbers" : "name states no values or finding"}`,
        );
      for (const svg of unit.svgs)
        if (!svg.roleOk)
          add("error", "B28", `${name}: the SVG has role="${svg.role}", not role="img"`);
      continue;
    }
    if (!unit.drawing) add("error", "B2", `${name}: no SVG with scripts off`);
    if (!unit.title) add("error", "B18", `${name}: no visible title`);
    if (!unit.finding) add("error", "B18", `${name}: no finding sentence in the HTML`);
    else if (unit.findingHidden)
      add("warning", "B18", `${name}: the finding sentence is hidden from sight`);
    if (!unit.caption) add("error", "B18", `${name}: no caption`);
    if (!unit.table) add("error", "B30", `${name}: no data table`);
    else {
      if (unit.table.th === 0)
        add("error", "B28", `${name}: the data table has no th header cells`);
      if (unit.table.unscoped > 0)
        add("error", "B28", `${name}: ${unit.table.unscoped} th without scope`);
      if (!unit.table.caption) add("error", "B28", `${name}: the data table has no caption`);
    }
    for (const svg of unit.svgs) {
      if (!svg.roleOk)
        add(
          "error",
          "B28",
          `${name}: the SVG has role="${svg.role}", not role="img" (or role="group" with aria-roledescription="chart" when enhanced)`,
        );
      if (!svg.name) add("error", "B28", `${name}: the SVG has no accessible name`);
    }
    if (unit.bytes > budget)
      add(
        "error",
        "D6",
        `${name}: ${(unit.bytes / 1024).toFixed(1)} kB of inline SVG, over the ${values["chart-kb"]} kB budget`,
      );
    if (!unit.csv) add(frameSeverity, "C1", `${name}: no CSV link`);
    if (!unit.source) add(frameSeverity, "C2", `${name}: no source line`);
    if (!unit.frame) add(frameSeverity, "F", `${name}: not in Capsomer's chart frame (.cap-chart)`);
  }
  const offLabels = new Set(off.units.map((unit) => unit.label));
  for (const unit of light.units) {
    if (!offLabels.has(unit.label))
      add(
        "error",
        "B2",
        `${unit.label} (${unit.kind}): drawn only with scripts on, so there is no chart, text or table without them`,
      );
  }
  for (const [scheme, pass] of /** @type {const} */ ([
    ["light", light],
    ["dark", dark],
  ])) {
    for (const unit of pass.units) {
      const name = `${unit.label} (${unit.kind})`;
      const m = unit.measured;
      if (!m) continue;
      if (m.lowText)
        add(
          "error",
          "B1",
          `${name}, ${scheme}: ${m.lowText.count} text under 4.5:1, lowest "${m.lowText.sample}" ${m.lowText.fg} on ${m.lowText.bg} at ${m.lowText.ratio.toFixed(2)}:1`,
        );
      if (m.lowMark)
        add(
          "error",
          "B1",
          `${name}, ${scheme}: ${m.lowMark.count} marks under 3:1, lowest ${m.lowMark.sample} ${m.lowMark.fg} on ${m.lowMark.bg} at ${m.lowMark.ratio.toFixed(2)}:1`,
        );
      if (scheme === "light" && m.smallText)
        add(
          "error",
          "B3",
          `${name}: ${m.smallText.count} text under 12 px, smallest "${m.smallText.sample}" at ${m.smallText.px.toFixed(1)} px`,
        );
      for (const v of m.axe) add("error", "B27", `${name}, ${scheme}: axe ${v}`);
    }
  }
  for (const unit of narrow.units) {
    const name = `${unit.label} (${unit.kind}), ${NARROW} px`;
    // A table chart is a data table, which WCAG 1.4.10 lets scroll sideways in its frame (two-dimensional layout).
    if (unit.overflow && !/^table\b/.test(unit.kind))
      add(
        "error",
        "C12",
        `${name}: the drawing is ${unit.overflow.content} px wide in a ${unit.overflow.box} px frame, so it scrolls sideways`,
      );
    const small = unit.measured?.smallText;
    if (small)
      add(
        "error",
        "C12",
        `${name}: ${small.count} text under 12 px, smallest "${small.sample}" at ${small.px.toFixed(1)} px`,
      );
  }
  for (const [width, pass] of /** @type {const} */ ([
    [1280, light],
    [NARROW, narrow],
  ])) {
    const score = total(pass.shifts);
    if (score < D5_LIMIT) continue;
    const worst = [...pass.shifts].sort((a, b) => b.value - a.value)[0];
    add(
      "error",
      "D5",
      `at ${width} px, charts shift the page by ${score.toFixed(3)} (layout shift); largest ${worst.value.toFixed(3)}, ${worst.moved}`,
    );
  }
  for (const library of libraries)
    add("error", "F", `loads ${library}; every chart is drawn by Enarratio`);
  for (const library of light.libraryCharts)
    add(
      "error",
      "B2",
      `a ${library} chart is drawn in the browser, so with scripts off there is no chart, text or table`,
    );
  for (const svg of new Set([...off.drawn, ...light.drawn]))
    add("error", "F", `an SVG chart drawn outside Enarratio: ${svg}`);
  return {
    charts: Math.max(off.units.length, light.units.length) + light.libraryCharts.length,
    findings: out,
  };
}

/**
 * Opens a page in a context and reads its charts; `measured` also reads the painted colors, sizes and axe.
 * @param {BrowserContext} context
 * @param {string} url
 * @param {boolean} measured
 * @param {boolean} [narrow] the 320 px pass: overflow and text size, no axe
 */
async function visit(context, url, measured, narrow = false) {
  // D5 is read at 1280 (the light pass) and at 320.
  const pinned = measured && (narrow || context === contexts.light);
  const page = await context.newPage();
  if (pinned) await page.addInitScript(pinChart, 0);
  /** @type {string[]} */
  const scriptUrls = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") scriptUrls.push(response.url());
  });
  try {
    let response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
    // A cache that now and then answers 200 with no body would read as a page with no chart. The
    // retry skips the browser's cache, which would otherwise revalidate and keep the empty body.
    for (
      let retry = 0;
      retry < 3 && response?.ok() && (await response.body()).length === 0;
      retry++
    ) {
      await (
        await context.newCDPSession(page)
      ).send("Network.setCacheDisabled", { cacheDisabled: true });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
    }
    if (!response || response.status() >= 400)
      throw new Error(`answered ${response?.status() ?? "nothing"}`);
    if ((await response.body()).length === 0)
      throw new Error("answered 200 with an empty body four times in 12 seconds");
    // A page behind a sign-in wall (Cloudflare Access, a site's own login) shows the sign-in page in its place: no chart on it
    // was read, so it must not pass as a page with none.
    const signIn = await signInWall(page, served(url));
    if (signIn)
      throw new Error(`redirected to sign-in at ${signIn}, so its charts were never read`);
    if (measured)
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
    // A chart in a closed fold is read as the reader sees it once they open the fold: a frame redraws at its width only then.
    let foldsAt = -1;
    if (await page.evaluate(openFolds)) {
      foldsAt = await page.evaluate(() => performance.now() - 50);
      await page.waitForTimeout(500);
    }
    // D5: the first chart was held in view as the page loaded; from here the check scrolls the page itself.
    const loading = pinned ? await page.evaluate(stopPin) : null;
    if (measured) {
      // Scroll the page as a reader would, so a chart a site draws again (or swaps for its narrow drawing)
      // as it nears the viewport is measured as the reader sees it; at 1280 too, on a page with a chart, for D5.
      if (pinned && (narrow || (await page.evaluate(hasChart)))) {
        // Each chart is brought into view and given a moment first, as a reader reaching it: a shift only counts while the
        // moved element is on screen, so one a lazy chart makes after a fast scroll has passed it would go unseen (D5).
        await page.evaluate(visitCharts);
        await page.evaluate(scrollThrough);
      }
      await page.evaluate(settle);
      if (!narrow) await page.evaluate(axeSource);
    }
    const libraries = LIBRARIES.map(
      ([name, container, , global]) => /** @type {const} */ ([name, container, global]),
    );
    const units = await page.evaluate(readCharts, { measured, narrow, libraries, tags: AXE_TAGS });
    const result = { units, ...(await page.evaluate(readStrays, libraries)) };
    /** @type {Array<{ t: number, value: number, moved: string }>} */
    let shifts = [];
    if (pinned && result.units.length > 0) {
      // A site may enhance its charts late (Foxhound's dashboard, about 5 s after load): the shifts are read once two seconds
      // pass with none.
      await page.evaluate(quietShifts, 0);
      shifts = await page.evaluate(readShifts, foldsAt);
      // A chart that changed its size out of sight as the page loaded moved nothing the Layout Instability API could count, so
      // the page is loaded again with that chart held in view, as a reader who scrolled to it would see it (at most 3 more loads).
      const opened = (/** @type {number} */ t) =>
        foldsAt >= 0 && t >= foldsAt && t < foldsAt + 1000;
      /** @type {Map<number, number>} */
      const unseen = new Map();
      for (const r of loading?.resized ?? [])
        if (r.index > 0 && !opened(r.t))
          unseen.set(r.index, Math.max(unseen.get(r.index) ?? 0, r.t));
      for (const [index, last] of [...unseen].slice(0, 3)) {
        if (total(shifts) >= D5_LIMIT) break;
        const again = await reloadPinned(context, url, index, last);
        if (total(again) > total(shifts)) shifts = again;
      }
    }
    for (const url of scriptUrls)
      if (!scripts.has(url))
        scripts.set(
          url,
          page.request
            .get(url)
            .then((r) => r.text())
            .catch(() => ""),
        );
    return { ...result, shifts, scripts: scriptUrls };
  } finally {
    await page.close();
  }
}

/**
 * Where a page sent the reader to sign in, or null when it did not: it landed on Cloudflare Access, was sent on to a sign-in or
 * log-in path, or was sent on to a page with a form that asks for a password. A password field on the page asked for is not a wall:
 * Capsomer's field demo (/components/field/states) shows one, and it answered 200 in place (2026-11-03).
 * @param {import("playwright-core").Page} page @param {string} asked
 */
async function signInWall(page, asked) {
  const landed = new URL(page.url());
  const wall =
    /(?:^|\.)cloudflareaccess\.com$/i.test(landed.hostname) ||
    /\/cdn-cgi\/access\//i.test(landed.pathname) ||
    (landed.href !== asked &&
      (/\/(?:sign-?in|log-?in|auth)(?:\/|$)/i.test(landed.pathname) ||
        (await page.locator('input[type="password"]').count()) > 0));
  return wall ? landed.origin + landed.pathname : null;
}

/** The chart libraries whose code is in the scripts a page loaded. @param {string[]} urls */
async function scriptLibraries(urls) {
  const names = new Set();
  for (const url of urls) {
    const code = await scripts.get(url);
    for (const [name, , signature] of LIBRARIES) if (signature.test(code)) names.add(name);
  }
  return names;
}

/** playwright-core's Chromium and axe-core's source, from the install or, failing that, a one-time cache install. */
async function loadTools() {
  try {
    const playwright = await import("playwright-core");
    const axe = await import("axe-core");
    return { chromium: playwright.chromium, axeSource: axe.default.source };
  } catch {
    const pins = createRequire(import.meta.url)("../package.json").peerDependencies;
    const specs = ["playwright-core", "axe-core"].map((name) => `${name}@${pins[name]}`);
    // In the user's own cache, never a shared /tmp, where another user could plant the install this one then runs.
    const name = `prelum-chart-audit-${specs.join("-").replace(/[^A-Za-z0-9.-]/g, "_")}`;
    const dir = join(homedir(), ".cache", name);
    // Installed in a directory of its own and moved into place once whole, so a second audit starting while the first
    // installs never finds half of it (axe-core lands before playwright-core).
    const ready = () => existsSync(join(dir, "node_modules", "playwright-core", "package.json"));
    if (!ready()) {
      const staging = `${dir}.${process.pid}`;
      mkdirSync(staging, { recursive: true, mode: 0o700 });
      writeFileSync(join(staging, "package.json"), "{}");
      console.error(`prelum-chart-audit: installing ${specs.join(" and ")} into ${dir}`);
      try {
        execFileSync(
          "npm",
          ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", ...specs],
          { cwd: staging, stdio: "pipe" },
        );
        if (!ready()) {
          rmSync(dir, { recursive: true, force: true });
          renameSync(staging, dir);
        }
      } catch (error) {
        // Another audit moved its install into place first: use that one.
        if (!ready()) throw error;
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    }
    const local = createRequire(join(dir, "package.json"));
    return { chromium: local("playwright-core").chromium, axeSource: local("axe-core").source };
  }
}

/** Playwright's own Chromium, else the system Chrome, else CHART_AUDIT_CHROME. @param {import("playwright-core").BrowserType} chromium */
async function launch(chromium) {
  const tries = [
    ...(process.env.CHART_AUDIT_CHROME ? [{ executablePath: process.env.CHART_AUDIT_CHROME }] : []),
    {},
    { channel: "chrome" },
  ];
  /** @type {string[]} */
  const errors = [];
  for (const options of tries) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch (error) {
      errors.push(String(error instanceof Error ? error.message : error).split("\n")[0]);
    }
  }
  throw new Error(errors.join("; "));
}

/** @param {Browser} browser @param {"light" | "dark"} colorScheme @param {boolean} javaScriptEnabled @param {number} [width] */
async function newContext(browser, colorScheme, javaScriptEnabled, width = 1280) {
  // Headless Chrome's own user agent says HeadlessChrome, which some bot rules refuse; this one names the audit instead.
  const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version().split(".")[0]}.0.0.0 Safari/537.36 prelum-chart-audit`;
  const context = await browser.newContext({
    colorScheme,
    javaScriptEnabled,
    reducedMotion: "reduce",
    bypassCSP: true,
    viewport: { width, height: 900 },
    userAgent,
  });
  if (javaScriptEnabled) await context.addInitScript(watchShifts);
  return context;
}

/** The D5 score of a pass's chart shifts. @param {Array<{ value: number }>} shifts */
function total(shifts) {
  return shifts.reduce((sum, s) => sum + s.value, 0);
}

/**
 * Loads a page again with its index-th chart held in view (D5), until a second past the time it last changed size in the first
 * load and then two quiet seconds; its chart shifts.
 * @param {BrowserContext} context @param {string} url @param {number} index @param {number} last
 */
async function reloadPinned(context, url, index, last) {
  const page = await context.newPage();
  try {
    await page.addInitScript(pinChart, index);
    await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(quietShifts, Math.min(last + 1000, 10_000));
    await page.evaluate(stopPin);
    return await page.evaluate(readShifts, -1);
  } catch {
    return [];
  } finally {
    await page.close();
  }
}
