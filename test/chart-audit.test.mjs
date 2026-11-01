// prelum-chart-audit against a local site with one clean page and one page of planted mistakes, in a real browser: a check
// that misses a chart without its table, an unnamed SVG, text that fails only in dark, another chart library, a chart
// drawn only by script or one that scrolls at 320 px calls a site clean that is not; one that flags the clean page fails every
// site that does it right. The clean page is a :::chart Prelum rendered, with render/chart-enhance redrawing it at 320 px, a
// textured series, an enhanced chart's role and inline primitives, so the check's exceptions and the redraw are proven together.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { rolldown } from "rolldown";

import { barChart } from "enarratio/lite";
import { defaultTheme } from "enarratio/themes";
import { baseStylesheet, sparkline, stylesheet, uptimeStrip } from "enarratio";
import { heatmap, pieChart } from "enarratio/plot";

import { render } from "../render.mjs";
import { editorialPack } from "../render-packs.mjs";

const bin = new URL("../bin/chart-audit.mjs", import.meta.url).pathname;
const chart = (/** @type {string} */ title, /** @type {object} */ extra = {}) =>
  barChart({ data: [{ year: "2024", posts: 3 }, { year: "2025", posts: 5 }, { year: "2026", posts: 4 }], x: "year", y: "posts", alt: `${title}: posts rose from 3 in 2024 to 5 in 2025.`, title, caption: "Counted from the archive.", source: { name: "the archive", href: "/archive" }, ...extra });
const frame = (/** @type {string} */ id, /** @type {string} */ body) => `<div class="cap-chart" id="${id}"><div class="cap-chart-figure">${body}</div></div>`;
const page = (/** @type {string} */ body, head = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Charts</title><meta name="color-scheme" content="light dark">` +
  `<link rel="stylesheet" href="/charts.css">${head}</head><body><main><h1>Charts</h1>${body}</main></body></html>`;

const post = await render({
  file: "post.md",
  body: ':::chart{type="bar" x="year" y="posts,talks" labels="Posts,Talks" alt="Posts rose from 3 in 2024 to 5 in 2025; talks stayed at 2." title="Posts and talks" source="the archive"}\n```csv\nyear,posts,talks\n2024,3,2\n2025,5,2\n2026,4,2\n```\n:::\n',
  resolveImage: async () => ({ width: 1, height: 1 }),
  options: { packs: [editorialPack({ assetPrefix: "test-" })] },
});
const entry = join(mkdtempSync(join(tmpdir(), "chart-audit-")), "charts.mjs");
writeFileSync(entry, `import { enhanceCharts } from ${JSON.stringify(new URL("../render-chart-enhance.mjs", import.meta.url).pathname)};\nenhanceCharts();\n`);
const bundle = await rolldown({ input: entry, platform: "browser", logLevel: "silent" });
const chartsJs = (await bundle.generate({ format: "esm" })).output[0].code;
await bundle.close();

const site = {
  "/": page("<p>No charts here.</p>"),
  "/good": page(
    [
      post.html,
      // B28: an enhanced chart's SVG is a group described as a chart (WAI-ARIA APG), drawn narrow enough for 320 px.
      frame("enhanced", chart("Talks per year", { width: 300 }).replace(/ role="img"/, ' role="group" aria-roledescription="chart"')),
      // Inline primitives: one named with its values, in a stat tile; one hidden beside the numbers, in a table row.
      `<dl><div class="cap-chart" data-variant="tile"><dt class="cap-chart-title">Posts</dt><dd>12 ${sparkline({ values: [3, 5, 4], alt: "Posts per year, 2024 to 2026: most in 2025, with 5.", inline: true })}</dd></div></dl>`,
      // B1's ground, not marks: a donut's hole in the background color, and the edge round a pale ramp step's swatch.
      frame("donut", pieChart({ data: [{ answer: "Yes", n: 60 }, { answer: "No", n: 40 }], label: "answer", value: "n", donut: true, centerLabel: "100", width: 300, alt: "Yes 60, no 40.", title: "Answers", source: { name: "the survey" } })),
      frame("cohorts", heatmap({ data: [1, 2, 3].flatMap((m) => ["A", "B"].map((c) => ({ month: `M${m}`, cohort: c, kept: m * 20 + (c === "A" ? 5 : 0) }))), x: "month", y: "cohort", value: "kept", width: 300, alt: "Cohort A kept more each month.", title: "Kept", source: { name: "the log" } })),
      `<table><caption>Uptime</caption><tr><th scope="row">API</th><td>99.9% ${uptimeStrip({ slots: ["up", "up", "down"], label: "API, last 3 hours", inline: true }).replace("<svg ", '<svg aria-hidden="true" ')}</td></tr></table>`,
    ].join(""),
    '<script type="module" src="/charts.js"></script>',
  ),
  "/bad": page(
    [
      // B30, B28 and F: no data table, an SVG with no role or name, and Enarratio's bare figure outside the frame.
      chart("No table", { csv: false }).replace(/<details[\s\S]*<\/details>/, "").replace(/ role="img" aria-label="[^"]*"/, ""),
      // B1 in dark only, and B3: the caption drawn at 10 px.
      frame("dim", chart("Dim in dark")),
      // B27: a link with no name inside the chart.
      frame("unnamed-link", chart("Unnamed link").replace("</figcaption>", '<a href="/more"></a></figcaption>')),
      // D6: over the 100 kB budget.
      frame("heavy", chart("Heavy").replace("<figure ", `<figure data-padding="${"x".repeat(110_000)}" `)),
      // F: an SVG chart drawn by hand.
      '<svg width="200" height="40" role="img" aria-label="Visits"><polyline fill="none" stroke="#333" points="0,40 50,20 100,30 150,5 200,12"/></svg>',
      '<div id="later"></div><script>document.getElementById("later").innerHTML = LATER;</script>',
      // B18: an inline primitive whose name gives no values.
      `<p>${sparkline({ values: [3, 5, 4], alt: "Trend", inline: true })}</p>`,
    ].join(""),
    `<style>@media (prefers-color-scheme: dark) { body { background: #111; color: #eee } #dim text { fill: #333 } } #dim figcaption { font-size: 10px }</style>` +
      `<script>const LATER = ${JSON.stringify(chart("Only with scripts"))};</script><script src="/vendor/chart.umd.js"></script>`,
  ),
  "/charts.js": chartsJs,
  // Reached only through --pages, and drawn only after --start set the demo cookie.
  "/demo/start": page("<p>Demo session started.</p>"),
  "/demo/charts": page(chart("Demo only", { csv: false }).replace(/<details[\s\S]*<\/details>/, "")),
  "/charts.css": `${baseStylesheet}\n${stylesheet(defaultTheme)}\nbody { background: #fff; color: #111 } @media (prefers-color-scheme: dark) { body { background: #111; color: #eee } }`,
  "/vendor/chart.umd.js": "/*! Chart.js v4.4.1 | (c) Chart.js Contributors */ window.Chart = function Chart() {};",
};

test("prelum-chart-audit finds every planted mistake, as an error with the page as proof, and nothing on the clean chart", async () => {
  const server = createServer((request, response) => {
    const origin = `http://${request.headers.host}`;
    const path = new URL(request.url ?? "/", origin).pathname;
    if (path === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      response.end(`<urlset>${["/", "/good", "/bad"].map((p) => `<url><loc>${origin}${p}</loc></url>`).join("")}</urlset>`);
      return;
    }
    const demo = /(?:^|;\s*)demo=1/.test(request.headers.cookie ?? "");
    const body = path === "/demo/charts" && !demo ? page("<p>Start a demo first.</p>") : /** @type {Record<string, string>} */ (site)[path];
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
    response.writeHead(body === undefined ? 404 : 200, { "content-type": type, ...(path === "/demo/start" ? { "set-cookie": "demo=1; Path=/" } : {}) });
    response.end(body ?? "not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = server.address();
  const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    /** @type {{ code: number | null, output: string }} */
    const { code, output } = await new Promise((resolve) => {
      let output = "";
      const child = spawn(process.execPath, [bin, "--origin", origin, "--pages", "/demo/charts", "--start", "/demo/start"], { stdio: ["ignore", "pipe", "pipe"] });
      child.stdout.on("data", (chunk) => (output += chunk));
      child.stderr.on("data", (chunk) => (output += chunk));
      child.on("close", (code) => resolve({ code, output }));
    });
    const lines = output.split("\n").filter((line) => line.startsWith("::"));
    const on = (/** @type {string} */ path) => lines.filter((line) => line.includes(`::${origin}${path} `));
    assert.equal(code, 1, output);
    assert.deepEqual(on("/good"), [], output);
    const bad = on("/bad");
    for (const [severity, item, detail] of [
      ["error", "B30", '"No table" (bar): no data table'],
      ["error", "B28", '"No table" (bar): the SVG has role="none"'],
      ["error", "B28", '"No table" (bar): the SVG has no accessible name'],
      ["error", "F", '"No table" (bar): not in Capsomer'],
      ["error", "C1", '"No table" (bar): no CSV link'],
      ["error", "C12", "320 px: the drawing is"],
      ["error", "B18", '"Trend" (inline sparkline): an inline primitive whose name states no values'],
      ["error", "B1", "#dim (bar), dark:"],
      ["error", "B3", "text under 12 px, smallest \"Dim in dark\""],
      ["error", "B27", "#unnamed-link (bar), light: axe link-name"],
      ["error", "D6", "kB of inline HTML, over the 100 kB budget"],
      ["error", "B2", '"Only with scripts" (bar): drawn only with scripts on'],
      ["error", "F", "loads Chart.js"],
      ["error", "F", 'an SVG chart drawn outside Enarratio: "Visits" (a polyline)'],
    ]) {
      assert.ok(bad.some((line) => line.startsWith(`::${severity} title=${item}::`) && line.includes(detail)), `${severity} ${item} ${detail}\n${output}`);
    }
    assert.ok(!bad.some((line) => line.includes("#dim (bar), light: ") && line.includes("title=B1")), `#dim passes in light\n${output}`);
    assert.ok(on("/demo/charts").some((line) => line.startsWith("::error title=B30::") && line.includes('"Demo only"')), output);
  } finally {
    server.close();
  }
});
