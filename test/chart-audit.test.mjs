// prelum-chart-audit against a local site with one clean chart and one page of planted mistakes, in a real browser: a check
// that misses a chart without its table, an unnamed SVG, text that fails only in dark, another chart library or a chart
// drawn only by script calls a site clean that is not; one that flags the clean chart fails every site that does it right.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

import { barChart } from "enarratio/lite";
import { defaultTheme } from "enarratio/themes";
import { baseStylesheet, stylesheet } from "enarratio";

const bin = new URL("../bin/chart-audit.mjs", import.meta.url).pathname;
const chart = (/** @type {string} */ title, /** @type {object} */ extra = {}) =>
  barChart({ data: [{ year: "2024", posts: 3 }, { year: "2025", posts: 5 }, { year: "2026", posts: 4 }], x: "year", y: "posts", alt: `${title}: posts rose from 3 in 2024 to 5 in 2025.`, title, caption: "Counted from the archive.", ...extra });
const frame = (/** @type {string} */ id, /** @type {string} */ body) =>
  `<figure class="cap-chart" id="${id}"><p class="cap-chart-summary">Posts rose from 3 in 2024 to 5 in 2025, then fell to 4.</p>${body}` +
  `<p class="cap-chart-source">Source: <a href="/archive">the archive</a></p><a href="/${id}.csv" download>Download CSV</a></figure>`;
const page = (/** @type {string} */ body, head = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Charts</title><meta name="color-scheme" content="light dark">` +
  `<link rel="stylesheet" href="/charts.css">${head}</head><body><main><h1>Charts</h1>${body}</main></body></html>`;

const site = {
  "/": page("<p>No charts here.</p>"),
  "/good": page(frame("good", chart("Posts per year"))),
  "/bad": page(
    [
      // B30, B28 and F: no data table, an SVG with no role or name, and Enarratio's bare figure outside the frame.
      chart("No table").replace(/<details[\s\S]*<\/details>/, "").replace(/ role="img" aria-label="[^"]*"/, ""),
      // B1 in dark only, and B3: the caption drawn at 10 px.
      frame("dim", chart("Dim in dark")),
      // B27: a link with no name inside the chart.
      frame("unnamed-link", chart("Unnamed link").replace("</figcaption>", '<a href="/more"></a></figcaption>')),
      // D6: over the 100 kB budget.
      frame("heavy", chart("Heavy").replace("<figure ", `<figure data-padding="${"x".repeat(110_000)}" `)),
      // F: an SVG chart drawn by hand.
      '<svg width="200" height="40" role="img" aria-label="Visits"><polyline fill="none" stroke="#333" points="0,40 50,20 100,30 150,5 200,12"/></svg>',
      '<div id="later"></div><script>document.getElementById("later").innerHTML = LATER;</script>',
    ].join(""),
    `<style>@media (prefers-color-scheme: dark) { body { background: #111; color: #eee } #dim text { fill: #333 } } #dim figcaption { font-size: 10px }</style>` +
      `<script>const LATER = ${JSON.stringify(chart("Only with scripts"))};</script><script src="/vendor/chart.umd.js"></script>`,
  ),
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
    const body = /** @type {Record<string, string>} */ (site)[path];
    const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html";
    response.writeHead(body === undefined ? 404 : 200, { "content-type": type });
    response.end(body ?? "not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = server.address();
  const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  try {
    /** @type {{ code: number | null, output: string }} */
    const { code, output } = await new Promise((resolve) => {
      let output = "";
      const child = spawn(process.execPath, [bin, "--origin", origin], { stdio: ["ignore", "pipe", "pipe"] });
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
      ["warning", "F", '"No table" (bar): not in Capsomer'],
      ["warning", "C1", '"No table" (bar): no CSV link'],
      ["error", "B1", "#dim (bar), dark:"],
      ["error", "B3", "#dim (bar): 1 text under 12 px"],
      ["error", "B27", "#unnamed-link (bar), light: axe link-name"],
      ["error", "D6", "#heavy (bar): 112.5 kB of inline HTML, over the 100 kB budget"],
      ["error", "B2", '"Only with scripts" (bar): drawn only with scripts on'],
      ["error", "F", "loads Chart.js"],
      ["error", "F", 'an SVG chart drawn outside Enarratio: "Visits" (a polyline)'],
    ]) {
      assert.ok(bad.some((line) => line.startsWith(`::${severity} title=${item}::`) && line.includes(detail)), `${severity} ${item} ${detail}\n${output}`);
    }
    assert.ok(!bad.some((line) => line.includes("#dim (bar), light: ") && line.includes("title=B1")), `#dim passes in light\n${output}`);
  } finally {
    server.close();
  }
});
