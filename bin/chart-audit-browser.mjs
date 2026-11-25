// The browser prelum-chart-audit drives: Playwright's Chromium and axe-core (installed once into a cache when the site has
// neither), one context per way a page is read, and the chart libraries it looks for.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

import { watchShifts } from "./chart-audit-page.mjs";

/** @typedef {import("playwright-core").Browser} Browser */

export const LIBRARIES = /** @type {const} */ ([
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

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** playwright-core's Chromium and axe-core's source, from the install or, failing that, a one-time cache install. */
export async function loadTools() {
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
export async function launch(chromium) {
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
export async function newContext(browser, colorScheme, javaScriptEnabled, width = 1280) {
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

// D5: chart layout shift at or over this is an error. The checklist asks for 0; under 0.01 is sub-pixel rounding.
export const D5_LIMIT = 0.01;
// The narrow pass: a phone in portrait, the width WCAG 1.4.10 (reflow) names.
export const NARROW = 320;
