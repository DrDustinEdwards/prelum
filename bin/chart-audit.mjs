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
//   D6   the chart's inline HTML is over --chart-kb
//   F    the page loads another chart library, or draws an SVG chart outside Enarratio; the chart is not in the frame
//   C1   no CSV link; C2 no source line
//   C12  at 320 px wide (scripts on), the drawing overflows its frame sideways, or chart text is drawn under 12 px
//
// An inline primitive (Enarratio's `inline: true`: a bare sparkline, heat strip, progress ring, uptime strip or timeline in a stat
// tile or a table row, outside any figure) needs no frame, title, caption, CSV or table. It passes when it is role="img" with a
// name that states its values or finding, or when it is aria-hidden beside visible text that gives the numbers; else B18.
//
// C1, C2 and the frame are errors; --no-strict-frame makes them warnings (--strict-frame, the old opt-in, is still accepted).
// --pages adds pages to the crawl (a file of URLs or paths, one per line, or a comma list), for charts no link reaches; each
// --start URL is opened first in every browser context, so a demo route that sets a session cookie opens the pages behind it. A page the browser could not open is titled G:
// an error when it answers 200 with an empty body (broken for every reader), a warning otherwise. Exits 0 with no errors, 1 with any, and 2 when it could not run: the site or its sitemap does not
// answer, no page opened, or no browser started.
//
// Needs playwright-core and axe-core (optional peers); when they are not installed it installs the pinned versions into a
// cache directory once, so the scoreboard's bare install can run it. It drives Playwright's Chromium when installed, else
// the system Chrome, else the browser at CHART_AUDIT_CHROME.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { crawlSite } from "../audit.mjs";

/** @typedef {import("playwright-core").Browser} Browser */
/** @typedef {import("playwright-core").BrowserContext} BrowserContext */
/** @typedef {{ severity: "error" | "warning", item: string, url: string, detail: string }} Finding */

const LIBRARIES = /** @type {const} */ ([
  // name, DOM container, a string only that library's code carries, and the page global it sets
  ["Recharts", ".recharts-wrapper, .recharts-surface", /recharts-(?:wrapper|surface|cartesian)/, null],
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
    "strict-frame": { type: "boolean", default: false },
    "no-strict-frame": { type: "boolean", default: false },
    pages: { type: "string" },
    start: { type: "string", multiple: true, default: [] },
  },
});
if (!values.origin) {
  console.error("usage: prelum-chart-audit --origin https://example.com [--from https://preview.example] [--max-pages 1500] [--chart-kb 100] [--no-strict-frame] [--pages <file | a,b>] [--start <url>]...");
  process.exit(2);
}
const origin = values.origin.replace(/\/$/, "");
const from = values.from?.replace(/\/$/, "");
const served = (/** @type {string} */ url) => (from && url.startsWith(origin) ? from + url.slice(origin.length) : url);
/** @type {typeof fetch} */
const fetcher = (input, init) => fetch(served(typeof input === "string" ? input : input instanceof URL ? input.href : input.url), init);
const budget = Number(values["chart-kb"]) * 1024;
const frameSeverity = values["no-strict-frame"] ? "warning" : "error";
// The narrow pass: a phone in portrait, the width WCAG 1.4.10 (reflow) names.
const NARROW = 320;
const at = (/** @type {string} */ ref) => new URL(ref, `${origin}/`).href;
/** @type {string[]} */
const extra = values.pages
  ? (existsSync(values.pages) ? readFileSync(values.pages, "utf8").split(/\r?\n/) : values.pages.split(","))
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map(at)
  : [];
const starts = (values.start ?? []).map(at);

const home = await fetcher(`${origin}/`).catch((error) => error);
if (!(home instanceof Response) || home.status >= 500) {
  console.error(`prelum-chart-audit: ${origin} did not answer: ${home instanceof Response ? home.status : home.message}`);
  process.exit(2);
}
const { pages, sitemap } = await crawlSite({ origin, fetch: fetcher, maxPages: 3000 });
if (sitemap.length === 0 && extra.length === 0) {
  console.error(`prelum-chart-audit: ${origin}/sitemap.xml lists no pages, or did not load, so there is nothing to crawl`);
  process.exit(2);
}
// One URL per path: a filter link (`/?year=2024`) draws the page's charts again, so it would only repeat their findings. A
// redirect the crawl stopped at is followed to its target, and a same-origin iframe a page shows (a component's
// examples) is opened as a page of its own.
/** @type {string[]} */
const queue = [];
const paths = new Set();
const enqueue = (/** @type {string} */ url) => {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/(\/index)?(\.html)?\/?$/, "");
  if (parsed.origin !== origin || paths.has(path) || paths.size >= Number(values["max-pages"])) return;
  paths.add(path);
  queue.push(parsed.href);
};
// The named pages first, so --max-pages never drops them.
for (const url of extra) enqueue(url);
for (const page of pages) {
  if (page.status === 200 && (page.html !== undefined || /html/i.test(String(/** @type {Record<string, string>} */ (page.headers ?? {})["content-type"] ?? "")))) enqueue(page.url);
  else if (page.status >= 300 && page.status < 400 && page.location) enqueue(new URL(page.location, page.url).href);
}

let browser;
/** @type {string} */
let axeSource;
try {
  const tools = await loadTools();
  axeSource = tools.axeSource;
  browser = await launch(tools.chromium);
} catch (error) {
  console.error(`prelum-chart-audit: could not start a browser: ${error instanceof Error ? error.message : error}`);
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
      if (!response || response.status() >= 400) throw new Error(`answered ${response?.status() ?? "nothing"}`);
    } catch (error) {
      console.error(`prelum-chart-audit: the start URL ${url} did not open: ${String(error instanceof Error ? error.message : error).split("\n")[0]}`);
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
        // An empty page is broken for every reader, so it fails; a timeout or a refused load may be this run's alone.
        findings.push({ severity: message.startsWith("answered 200 with an empty body") ? "error" : "warning", item: "G", url, detail: `the browser could not open it: ${message}` });
      } finally {
        busy--;
      }
    }
  }),
);
await browser.close();
if (opened === 0) {
  console.error(`prelum-chart-audit: none of the ${paths.size} pages on ${origin} opened in the browser`);
  process.exit(2);
}

const seen = new Set();
const unique = findings.filter((f) => {
  const key = `${f.severity} ${f.item} ${f.url} ${f.detail}`;
  return !seen.has(key) && seen.add(key);
});
unique.sort((a, b) => a.url.localeCompare(b.url) || a.item.localeCompare(b.item, "en", { numeric: true }));
for (const f of unique) console.log(`::${f.severity} title=${f.item}::${f.url} ${f.detail.replace(/\r?\n/g, " ")}`);
/** @type {Record<string, number>} */
const summary = {};
for (const f of unique) summary[f.item] = (summary[f.item] ?? 0) + 1;
const counts = Object.entries(summary).map(([item, n]) => `${item} ${n}`).join(", ") || "no findings";
console.log(`prelum-chart-audit: ${opened} pages on ${origin}, ${charts} charts on ${withCharts} of them; ${counts}.`);
process.exit(unique.some((f) => f.severity === "error") ? 1 : 0);

/**
 * One page: with scripts on in light first, and only when that finds a chart, a chart library or a drawn SVG, again with
 * scripts off and in dark.
 * @param {string} url
 * @returns {Promise<{ charts: number, findings: Finding[] }>}
 */
async function auditPage(url) {
  const light = await visit(contexts.light, url, true);
  for (const frame of light.frames) enqueue(from && frame.startsWith(from) ? origin + frame.slice(from.length) : frame);
  const libraries = new Set([...light.libraries, ...(await scriptLibraries(light.scripts))]);
  if (light.units.length === 0 && light.drawn.length === 0 && libraries.size === 0) return { charts: 0, findings: [] };
  const off = await visit(contexts.off, url, false);
  const dark = await visit(contexts.dark, url, true);
  const narrow = await visit(contexts.narrow, url, true, true);
  /** @type {Finding[]} */
  const out = [];
  const add = (/** @type {"error" | "warning"} */ severity, /** @type {string} */ item, /** @type {string} */ detail) => out.push({ severity, item, url, detail });

  for (const unit of off.units) {
    const name = `${unit.label} (${unit.kind})`;
    if (unit.inline) {
      // An inline primitive carries its own words, or sits beside the words that carry its numbers.
      if (!unit.inline.ok) add("error", "B18", `${name}: an inline primitive whose ${unit.inline.hidden ? "visible neighbor gives no numbers" : "name states no values or finding"}`);
      for (const svg of unit.svgs) if (!svg.roleOk) add("error", "B28", `${name}: the SVG has role="${svg.role}", not role="img"`);
      continue;
    }
    if (!unit.drawing) add("error", "B2", `${name}: no SVG with scripts off`);
    if (!unit.title) add("error", "B18", `${name}: no visible title`);
    if (!unit.finding) add("error", "B18", `${name}: no finding sentence in the HTML`);
    else if (unit.findingHidden) add("warning", "B18", `${name}: the finding sentence is hidden from sight`);
    if (!unit.caption) add("error", "B18", `${name}: no caption`);
    if (!unit.table) add("error", "B30", `${name}: no data table`);
    else {
      if (unit.table.th === 0) add("error", "B28", `${name}: the data table has no th header cells`);
      if (unit.table.unscoped > 0) add("error", "B28", `${name}: ${unit.table.unscoped} th without scope`);
      if (!unit.table.caption) add("error", "B28", `${name}: the data table has no caption`);
    }
    for (const svg of unit.svgs) {
      if (!svg.roleOk) add("error", "B28", `${name}: the SVG has role="${svg.role}", not role="img" (or role="group" with aria-roledescription="chart" when enhanced)`);
      if (!svg.name) add("error", "B28", `${name}: the SVG has no accessible name`);
    }
    if (unit.bytes > budget) add("error", "D6", `${name}: ${(unit.bytes / 1024).toFixed(1)} kB of inline HTML, over the ${values["chart-kb"]} kB budget`);
    if (!unit.csv) add(frameSeverity, "C1", `${name}: no CSV link`);
    if (!unit.source) add(frameSeverity, "C2", `${name}: no source line`);
    if (!unit.frame) add(frameSeverity, "F", `${name}: not in Capsomer's chart frame (.cap-chart)`);
  }
  const offLabels = new Set(off.units.map((unit) => unit.label));
  for (const unit of light.units) {
    if (!offLabels.has(unit.label)) add("error", "B2", `${unit.label} (${unit.kind}): drawn only with scripts on, so there is no chart, text or table without them`);
  }
  for (const [scheme, pass] of /** @type {const} */ ([["light", light], ["dark", dark]])) {
    for (const unit of pass.units) {
      const name = `${unit.label} (${unit.kind})`;
      const m = unit.measured;
      if (!m) continue;
      if (m.lowText) add("error", "B1", `${name}, ${scheme}: ${m.lowText.count} text under 4.5:1, lowest "${m.lowText.sample}" ${m.lowText.fg} on ${m.lowText.bg} at ${m.lowText.ratio.toFixed(2)}:1`);
      if (m.lowMark) add("error", "B1", `${name}, ${scheme}: ${m.lowMark.count} marks under 3:1, lowest ${m.lowMark.sample} ${m.lowMark.fg} on ${m.lowMark.bg} at ${m.lowMark.ratio.toFixed(2)}:1`);
      if (scheme === "light" && m.smallText) add("error", "B3", `${name}: ${m.smallText.count} text under 12 px, smallest "${m.smallText.sample}" at ${m.smallText.px.toFixed(1)} px`);
      for (const v of m.axe) add("error", "B27", `${name}, ${scheme}: axe ${v}`);
    }
  }
  for (const unit of narrow.units) {
    const name = `${unit.label} (${unit.kind}), ${NARROW} px`;
    if (unit.overflow) add("error", "C12", `${name}: the drawing is ${unit.overflow.content} px wide in a ${unit.overflow.box} px frame, so it scrolls sideways`);
    const small = unit.measured?.smallText;
    if (small) add("error", "C12", `${name}: ${small.count} text under 12 px, smallest "${small.sample}" at ${small.px.toFixed(1)} px`);
  }
  for (const library of libraries) add("error", "F", `loads ${library}; every chart is drawn by Enarratio`);
  for (const library of light.libraryCharts) add("error", "B2", `a ${library} chart is drawn in the browser, so with scripts off there is no chart, text or table`);
  for (const svg of new Set([...off.drawn, ...light.drawn])) add("error", "F", `an SVG chart drawn outside Enarratio: ${svg}`);
  return { charts: Math.max(off.units.length, light.units.length) + light.libraryCharts.length, findings: out };
}

/**
 * Opens a page in a context and reads its charts; `measured` also reads the painted colors, sizes and axe.
 * @param {BrowserContext} context
 * @param {string} url
 * @param {boolean} measured
 * @param {boolean} [narrow] the 320 px pass: overflow and text size, no axe
 */
async function visit(context, url, measured, narrow = false) {
  const page = await context.newPage();
  /** @type {string[]} */
  const scriptUrls = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") scriptUrls.push(response.url());
  });
  try {
    let response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
    // A cache that now and then answers 200 with no body (germomics, October 2026) would read as a page with no chart. The
    // retry skips the browser's cache, which would otherwise revalidate and keep the empty body.
    for (let retry = 0; retry < 3 && response?.ok() && (await response.body()).length === 0; retry++) {
      await (await context.newCDPSession(page)).send("Network.setCacheDisabled", { cacheDisabled: true });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
    }
    if (!response || response.status() >= 400) throw new Error(`answered ${response?.status() ?? "nothing"}`);
    if ((await response.body()).length === 0) throw new Error("answered 200 with an empty body four times in 12 seconds");
    if (measured) {
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      await page.evaluate(settle);
      if (!narrow) await page.evaluate(axeSource);
    }
    const result = await page.evaluate(readCharts, { measured, narrow, libraries: LIBRARIES.map(([name, container, , global]) => /** @type {const} */ ([name, container, global])), tags: AXE_TAGS });
    for (const url of scriptUrls) if (!scripts.has(url)) scripts.set(url, page.request.get(url).then((r) => r.text()).catch(() => ""));
    return { ...result, scripts: scriptUrls };
  } finally {
    await page.close();
  }
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

/** In the page: fonts loaded and every finite animation finished, so colors are read as they rest. */
function settle() {
  const animations = document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
  const done = Promise.all([document.fonts.ready, ...animations.map((a) => a.finished.catch(() => undefined))]);
  return Promise.race([done, new Promise((resolve) => setTimeout(resolve, 3000))]).then(() => undefined);
}

/**
 * In the page: every chart, what the checks read from it, and with `measured` its painted contrast, text sizes and axe
 * violations; plus the chart libraries the page carries and the SVG charts it draws outside Enarratio.
 * @param {{ measured: boolean, narrow: boolean, libraries: Array<readonly [string, string | null, string | null]>, tags: string[] }} input
 */
async function readCharts({ measured, narrow, libraries, tags }) {
  const text = (/** @type {Element | null | undefined} */ el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const shown = (/** @type {Element} */ el) => {
    const box = el.getBoundingClientRect();
    return box.width * box.height > 2 && el.checkVisibility({ visibilityProperty: true });
  };
  const libraryContainers = libraries.map(([, container]) => container).filter(Boolean).join(", ");

  const roots = new Set();
  for (const el of Array.from(document.querySelectorAll(".enarratio[data-enarratio], .cap-chart"))) {
    if (libraryContainers && el.closest(libraryContainers)) continue;
    roots.add(el.closest(".cap-chart") ?? el.closest("figure.enarratio") ?? el);
  }
  // A frame showing no data, or Capsomer's refusal in place of a chart, carries no figure to check.
  const units = [...roots].filter((unit) => !["nodata", "refused"].includes(unit.getAttribute("data-state") ?? ""));
  const PRIMITIVES = ["sparkline", "heat-strip", "progress-ring", "uptime-strip", "timeline"];
  // At the narrow width: a frame that scrolls (its content wider than its box), or a drawing wider than the chart around it.
  const overflowOf = (/** @type {Element} */ unit) => {
    for (const el of [unit, ...Array.from(unit.querySelectorAll(".enarratio-frame, .cap-chart-figure, .cap-chart-body, figure.enarratio"))]) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) return { content: el.scrollWidth, box: el.clientWidth };
    }
    const outer = (unit.matches("svg") ? unit.parentElement : unit)?.getBoundingClientRect();
    for (const svg of Array.from(unit.querySelectorAll("svg")).concat(unit.matches("svg") ? [/** @type {any} */ (unit)] : [])) {
      const box = svg.getBoundingClientRect();
      if (outer && box.width > 0 && box.right > outer.right + 1) return { content: Math.round(box.width), box: Math.round(outer.width) };
    }
    return null;
  };

  // Paint on a one-pixel canvas, so any CSS color syntax and any alpha composite as the browser would.
  const ctx = /** @type {CanvasRenderingContext2D} */ (Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true }));
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && /dark/.test(getComputedStyle(document.documentElement).colorScheme);
  const paint = (/** @type {Array<[string, number]>} */ layers) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, 1, 1);
    for (const [color, alpha] of layers) {
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const behind = (/** @type {Element} */ el) => {
    /** @type {Array<[string, number]>} */
    const layers = [];
    for (let node = /** @type {Element | null} */ (el); node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") layers.unshift([bg, 1]);
    }
    return layers;
  };
  const luminance = (/** @type {number[]} */ rgb) => {
    const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hex = (/** @type {number[]} */ rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  // Inside an SVG, what is behind a label is the page behind the SVG and then the last shape drawn before it that covers
  // its center (a label on a gene's box). A mark is read against the page, not against the marks it touches.
  /** @type {Map<Element, Array<{ el: Element, box: DOMRect, fill: string, alpha: number }>>} */
  const shapesOf = new Map();
  const under = (/** @type {Element} */ el) => {
    const svg = el instanceof SVGElement ? el.closest("svg") : null;
    if (!svg) return [];
    if (!shapesOf.has(svg)) {
      shapesOf.set(svg, Array.from(svg.querySelectorAll("rect, circle, ellipse, path, polygon")).flatMap((shape) => {
        const style = getComputedStyle(shape);
        const alpha = Number(style.fillOpacity) * Number(style.opacity);
        const fill = solid(style.fill);
        return isColor(fill) && alpha > 0 ? [{ el: shape, box: shape.getBoundingClientRect(), fill, alpha }] : [];
      }));
    }
    const box = el.getBoundingClientRect();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    /** @type {Array<[string, number]>} */
    let layer = [];
    for (const shape of /** @type {Array<{ el: Element, box: DOMRect, fill: string, alpha: number }>} */ (shapesOf.get(svg))) {
      if (shape.el === el) break;
      if (shape.el.contains(el) || x < shape.box.left || x > shape.box.right || y < shape.box.top || y > shape.box.bottom) continue;
      layer = [[shape.fill, shape.alpha]];
    }
    return layer;
  };
  const contrast = (/** @type {Element} */ el, /** @type {string} */ color, /** @type {number} */ alpha, /** @type {Element} */ ground, label = false) => {
    const layers = [...behind(ground), ...(label ? under(el) : [])];
    const bg = paint(layers);
    const fg = paint([...layers, [color, alpha]]);
    const [a, b] = [luminance(fg), luminance(bg)];
    return { fg: hex(fg), bg: hex(bg), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), el };
  };
  const opacity = (/** @type {Element} */ el, /** @type {Element} */ stop) => {
    let value = 1;
    for (let node = /** @type {Element | null} */ (el); node && node !== stop.parentElement; node = node.parentElement) value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  // The theme's grid color as painted where the chart is: the custom property's value, resolved by a probe element so
  // light-dark() and color functions resolve too.
  /** @type {Map<string, string>} */
  const grids = new Map();
  const gridOf = (/** @type {Element} */ el) => {
    const raw = getComputedStyle(el).getPropertyValue("--enarratio-grid").trim();
    if (!raw) return "";
    if (!grids.has(raw)) {
      const probe = document.createElement("span");
      probe.style.color = raw;
      (el.closest("svg")?.parentElement ?? document.body).append(probe);
      grids.set(raw, hex(paint([[getComputedStyle(probe).color, 1]])));
      probe.remove();
    }
    return grids.get(raw);
  };
  const isColor = (/** @type {string} */ paint) => Boolean(paint) && !/^(none|transparent|url\()|^rgba\([^)]*,\s*0\)$/.test(paint);
  // A fill of url(#id) is painted by a pattern or a gradient: read it as the pattern's base <rect> (Enarratio's texture fills
  // draw the series color first, the texture over it) or the gradient's first stop, or it would read as nothing painted.
  /** @type {(paint: string, depth?: number) => string} */
  const solid = (paint, depth = 0) => {
    const ref = /^url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(paint ?? "");
    if (!ref || depth > 3) return paint;
    const target = document.getElementById(ref[1]);
    if (!target) return paint;
    const tag = target.tagName.toLowerCase();
    if (tag === "pattern") {
      /** @type {Element | undefined} */
      const base = Array.from(target.querySelectorAll("rect")).find((rect) => isColor(solid(getComputedStyle(rect).fill, depth + 1)));
      return base ? solid(getComputedStyle(base).fill, depth + 1) : paint;
    }
    if (tag === "lineargradient" || tag === "radialgradient") {
      const stop = target.querySelector("stop");
      return stop ? getComputedStyle(stop).stopColor : paint;
    }
    return paint;
  };
  const describe = (/** @type {Element} */ el) => {
    const mark = el.closest("[data-enarratio-mark]")?.getAttribute("data-enarratio-mark");
    return `<${el.tagName.toLowerCase()}${mark ? ` in ${mark}` : ""}>`;
  };

  const out = units.map((unit, index) => {
    unit.setAttribute("data-chart-audit", String(index));
    const own = (/** @type {string} */ selector) => (unit.matches(selector) ? unit : unit.querySelector(selector));
    const svgs = [unit, ...Array.from(unit.querySelectorAll("svg"))].filter((el) => el.tagName.toLowerCase() === "svg" && !el.parentElement?.closest("svg") && el.getAttribute("aria-hidden") !== "true");
    // Enarratio's `inline: true` primitive: the bare drawing, outside any figure or frame.
    // Enarratio's `inline: true` primitives: bare drawings, in no Enarratio figure, alone or in a frame that is not a chart's (a
    // Capsomer stat tile, a table cell). The unit is inline when every Enarratio drawing in it is one.
    const pieces = [unit, ...Array.from(unit.querySelectorAll("[data-enarratio]"))].filter((el) => el.hasAttribute("data-enarratio"));
    const bare = pieces.length > 0 && !unit.matches("figure.enarratio") && !unit.querySelector("figure.enarratio") && pieces.every((el) => PRIMITIVES.includes(el.getAttribute("data-enarratio") ?? ""));
    /** @type {null | { hidden: boolean, ok: boolean }} */
    let inline = null;
    if (bare) {
      const verdicts = pieces.map((piece) => {
        if (piece.getAttribute("aria-hidden") === "true" || piece.closest("[aria-hidden='true']")) {
          // The words beside it: the nearest ancestor (a stat tile, a table row) with visible text of its own.
          let near = piece.parentElement;
          const said = (/** @type {Element} */ el) => (/** @type {HTMLElement} */ (el).innerText ?? "").trim();
          while (near && near !== document.body && !said(near)) near = near.parentElement;
          return { hidden: true, ok: Boolean(near) && /\d/.test(said(/** @type {Element} */ (near))) };
        }
        const name = (piece.getAttribute("aria-label") ?? "").trim() || (piece.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((/** @type {string} */ id) => text(document.getElementById(id))).join(" ").trim();
        return { hidden: false, ok: piece.getAttribute("role") === "img" && (/\d/.test(name) || name.split(/\s+/).length >= 4) };
      });
      inline = verdicts.find((v) => !v.ok) ?? { hidden: verdicts.every((v) => v.hidden), ok: true };
    }
    const drawing = own(".enarratio-frame svg, svg.enarratio, div.enarratio, .cap-chart-body svg") ?? svgs[0] ?? null;
    const title = text(own(".enarratio-title, .cap-chart-title"));
    const finding = own(".enarratio-finding, .enarratio-summary, .cap-chart-reason");
    const table = unit.querySelector("table");
    const names = svgs.map((svg) => {
      const labeledBy = (svg.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((/** @type {string} */ id) => text(document.getElementById(id))).join(" ").trim();
      const role = svg.getAttribute("role") ?? "none";
      // WAI-ARIA APG: a static chart is an image; an enhanced one the reader can enter is a group described as a chart.
      const roleOk = role === "img" || (role === "group" && (svg.getAttribute("aria-roledescription") ?? "").trim().toLowerCase() === "chart");
      return { role, roleOk, name: (svg.getAttribute("aria-label") ?? "").trim() || labeledBy || text(svg.querySelector(":scope > title")) };
    });
    const kindFirst = [...new Set([unit, ...Array.from(unit.querySelectorAll("[data-enarratio]"))].map((el) => el.getAttribute("data-enarratio")).filter(Boolean))].join("+") || "frame";
    const kind = bare ? `inline ${kindFirst}` : kindFirst;
    const label = unit.id ? `#${unit.id}` : `"${(title || names[0]?.name || kind).slice(0, 60)}"`;
    const sourceText = Array.from(unit.querySelectorAll("p, figcaption, small, footer")).some((el) => /^(sources?|data)\s*:/i.test(text(el)));
    return {
      label,
      kind,
      drawing: Boolean(drawing),
      title,
      finding: Boolean(text(finding)),
      findingHidden: Boolean(finding && (finding.closest("[data-summary='hidden']") || !shown(finding))),
      caption: Boolean(text(unit.querySelector("figcaption, .cap-chart-caption"))),
      table: table && {
        th: table.querySelectorAll("th").length,
        unscoped: Array.from(table.querySelectorAll("th")).filter((th) => !th.getAttribute("scope")).length,
        caption: Boolean(text(table.querySelector("caption"))),
      },
      svgs: names,
      bytes: new Blob([unit.outerHTML]).size,
      csv: Boolean(unit.querySelector("a[href$='.csv' i], a[href*='.csv?' i], a[href^='data:text/csv' i], a[download][href*='csv' i], a.enarratio-csv, .enarratio-csv a")),
      source: Boolean(unit.querySelector(".enarratio-source, .cap-chart-source, [data-chart-source]")) || sourceText,
      frame: unit.matches(".cap-chart"),
      inline,
      overflow: narrow ? overflowOf(unit) : null,
      measured: /** @type {null | { lowText: any, lowMark: any, smallText: any, axe: string[] }} */ (null),
    };
  });

  if (measured) {
    for (const [index, unit] of units.entries()) {
      /** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */
      const lowText = [];
      /** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */
      const lowMark = [];
      /** @type {Array<{ px: number, el: Element }>} */
      const small = [];
      const texts = [...(unit.matches("svg") ? [unit] : []), ...Array.from(unit.querySelectorAll("*"))].filter(
        (el) => el.tagName.toLowerCase() === "text" || (!(el instanceof SVGElement) && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())),
      );
      for (const el of texts) {
        if (!shown(el)) continue;
        const style = getComputedStyle(el);
        const svg = el instanceof SVGGraphicsElement ? el : null;
        const ground = svg ? /** @type {Element} */ (svg.ownerSVGElement ?? svg) : el;
        const color = svg ? solid(style.fill) : style.color;
        if (isColor(color)) {
          const reading = contrast(el, color, opacity(el, unit) * (svg ? Number(style.fillOpacity) : 1), ground, true);
          if (reading.ratio < 4.5) lowText.push(reading);
        }
        const matrix = svg?.getScreenCTM();
        const px = Number.parseFloat(style.fontSize) * (matrix ? Math.hypot(matrix.a, matrix.b) : 1);
        if (px < 11.95) small.push({ px, el });
      }
      for (const el of Array.from(unit.querySelectorAll("rect, circle, ellipse, path, line, polyline, polygon, .enarratio-swatch"))) {
        if (el.closest("defs, clipPath, mask, pattern, marker, [data-enarratio-mark*='grid'], [aria-hidden='true'] > title") || !el.checkVisibility({ visibilityProperty: true })) continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        const style = getComputedStyle(el);
        const ground = el instanceof SVGGraphicsElement ? /** @type {Element} */ (el.ownerSVGElement ?? el) : /** @type {Element} */ (el.parentElement);
        const base = opacity(el, unit);
        // A mark is seen by its fill or its outline, whichever stands out more; a translucent fill (an area under its
        // line) and the grid color (gridlines, a ring's track) are context, not marks.
        const grid = gridOf(el);
        const paints = el instanceof SVGElement
          ? [
              ...(el.tagName.toLowerCase() !== "line" ? [[solid(style.fill), base * Number(style.fillOpacity)]] : []),
              ...(Number.parseFloat(style.strokeWidth) >= 0.5 ? [[solid(style.stroke), base * Number(style.strokeOpacity)]] : []),
            ]
          : [
              [style.backgroundColor, base],
              // An HTML swatch's edge counts as its outline (Enarratio's 1px edge on a pale ramp step's legend swatch).
              ...(Number.parseFloat(style.borderTopWidth) >= 0.5 ? [[style.borderTopColor, base]] : []),
            ];
        const readings = /** @type {Array<[string, number]>} */ (paints)
          .filter(([color, alpha]) => isColor(color) && alpha >= 0.5 && hex(paint([[color, 1]])) !== grid)
          .map(([color, alpha]) => contrast(el, color, alpha, ground));
        if (readings.length === 0) continue;
        const reading = readings.reduce((a, b) => (b.ratio > a.ratio ? b : a));
        // A shape hidden from assistive technology and painted in the color behind it draws nothing to see: a donut's
        // hole, or a halo under a label. It is the ground, not a mark.
        if (el.getAttribute("aria-hidden") === "true" && reading.ratio < 1.1) continue;
        if (reading.ratio < 3) lowMark.push(reading);
      }
      const lowest = (/** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */ list, /** @type {boolean} */ quote) => {
        if (list.length === 0) return null;
        const worst = list.reduce((a, b) => (b.ratio < a.ratio ? b : a));
        return { count: list.length, fg: worst.fg, bg: worst.bg, ratio: worst.ratio, sample: quote ? text(worst.el).slice(0, 40) : describe(worst.el) };
      };
      const smallest = small.length ? small.reduce((a, b) => (b.px < a.px ? b : a)) : null;
      out[index].measured = {
        lowText: lowest(lowText, true),
        lowMark: lowest(lowMark, false),
        smallText: smallest && { count: small.length, px: smallest.px, sample: text(smallest.el).slice(0, 40) },
        axe: [],
      };
    }
    // @ts-ignore axe is the axe-core source the audit evaluated in the page
    const axe = /** @type {any} */ (window).axe;
    if (units.length > 0 && axe) {
      const { violations } = narrow ? { violations: [] } : await axe.run({ include: [["[data-chart-audit]"]] }, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"], elementRef: true });
      for (const violation of violations) {
        /** @type {Map<number, number>} */
        const hits = new Map();
        for (const node of violation.nodes) {
          const index = Number(node.element?.closest("[data-chart-audit]")?.getAttribute("data-chart-audit"));
          if (Number.isInteger(index)) hits.set(index, (hits.get(index) ?? 0) + 1);
        }
        for (const [index, count] of hits) out[index].measured?.axe.push(`${violation.id} (${violation.impact}): ${violation.help}, ${count} node${count === 1 ? "" : "s"}`);
      }
    }
  }

  /** @type {string[]} */
  const found = [];
  /** @type {string[]} */
  const libraryCharts = [];
  for (const [name, container, global] of libraries) {
    const count = container ? document.querySelectorAll(container).length : 0;
    if (count > 0) libraryCharts.push(name);
    // @ts-ignore a library's page global
    if (count > 0 || (global && window[global])) found.push(name);
  }
  // An SVG drawn from data outside Enarratio: a polyline, or five or more marks of one kind that vary as data does (bars
  // of different lengths, a strip of slots, five dots of one size at different places, five lines of different lengths on
  // one baseline). An illustration's circles of every size and its leader lines (a plate of plaques), a diagram's boxes
  // that hold their labels and its polygon nodes, and a decorative badge hidden with its lettering do not count.
  /** @type {string[]} */
  const drawn = [];
  const distinct = (/** @type {number[]} */ list) => new Set(list.map((n) => Math.round(n * 2))).size;
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    if (svg.parentElement?.closest("svg") || svg.closest(".enarratio, [data-enarratio]") || (libraryContainers && svg.closest(libraryContainers))) continue;
    const box = svg.getBoundingClientRect();
    if (box.width < 60 || box.height < 16) continue;
    if (svg.getAttribute("aria-hidden") === "true" && svg.querySelector("text")) continue;
    const boxes = (/** @type {string} */ tag) => Array.from(svg.querySelectorAll(tag)).map((el) => el.getBoundingClientRect());
    const labels = boxes("text").map((t) => [t.x + t.width / 2, t.y + t.height / 2]);
    const rects = boxes("rect").filter((r) => !labels.some(([x, y]) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom));
    const dots = boxes("circle, ellipse");
    const lines = boxes("line");
    const polyline = Array.from(svg.querySelectorAll("polyline")).some((el) => /** @type {SVGPolylineElement} */ (el).points.length >= 4);
    const why = polyline
      ? "a polyline"
      : rects.length >= 5 && (distinct(rects.map((r) => r.height)) >= 3 || distinct(rects.map((r) => r.width)) >= 3 || (rects.length >= 8 && distinct(rects.map((r) => r.x)) >= 8))
        ? `${rects.length} rects`
        : dots.length >= 5 && distinct(dots.map((d) => d.x * 10_000 + d.y)) >= 5 && dots.some((d) => dots.filter((e) => Math.abs(e.width - d.width) < 0.5).length >= 5)
          ? `${dots.length} dots`
          : lines.length >= 5 && distinct(lines.map((l) => Math.hypot(l.width, l.height))) >= 3 && [(/** @type {DOMRect} */ l) => l.bottom, (/** @type {DOMRect} */ l) => l.left].some((edge) => lines.some((l) => lines.filter((m) => Math.abs(edge(m) - edge(l)) < 0.5).length >= 5))
            ? `${lines.length} lines`
            : null;
    if (!why) continue;
    const heading = svg.closest("section, figure, article")?.querySelector("h1, h2, h3, h4, figcaption");
    const name = (svg.getAttribute("aria-label") ?? "").trim() || text(heading) || svg.getAttribute("class") || "an svg";
    drawn.push(`"${name.slice(0, 60)}" (${why})`);
  }
  const frames = Array.from(document.querySelectorAll("iframe[src]")).map((frame) => /** @type {HTMLIFrameElement} */ (frame).src);
  return { units: out, libraries: found, libraryCharts, drawn, frames };
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
    const dir = join(tmpdir(), `prelum-chart-audit-${specs.join("-").replace(/[^A-Za-z0-9.-]/g, "_")}`);
    if (!existsSync(join(dir, "node_modules", "axe-core", "package.json"))) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "package.json"), "{}");
      console.error(`prelum-chart-audit: installing ${specs.join(" and ")} into ${dir}`);
      execFileSync("npm", ["install", "--no-save", "--ignore-scripts", "--no-audit", "--no-fund", ...specs], { cwd: dir, stdio: "pipe" });
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
  return browser.newContext({ colorScheme, javaScriptEnabled, reducedMotion: "reduce", bypassCSP: true, viewport: { width, height: 900 }, userAgent });
}
