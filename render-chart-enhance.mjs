// The browser half of :::chart: Enarratio's enhancement layer (keyboard walk, focus announcements, tooltips, legend filters, a
// sortable table) on every chart Prelum rendered, and a redraw to the frame's width when it is narrower than the drawing, so a
// post's chart fits a 320 px phone instead of scrolling sideways. Capsomer's ChartFrame does the same for a chart drawn in React.
//
// Browser-only, nothing runs on import. A site bundles it into a same-origin script (no inline script, so a hash CSP holds) and
// calls `enhanceCharts()` once the document is parsed. Without it every chart still reads, with its table, as the server drew it.
//
// The redraw reads the figure's `data-prelum-chart`: bar, line and area are drawn again by `enarratio/lite`, which draws the same
// SVG as the server's `enarratio/plot` at any width; a dot chart (only `enarratio/plot` draws one, too heavy for a page) swaps in the
// 240 px drawing the server wrote beside it once the frame is narrower than 30rem.

import { enhance } from "enarratio/enhance";
import { areaChart, barChart, lineChart } from "enarratio/lite";

const DRAW = { bar: barChart, line: lineChart, area: areaChart };
// Enarratio's wide frame keeps a drawing 30rem wide and scrolls it; under that the narrow drawing is used.
const WIDE_REM = 30;
// Narrower than this, a redraw would crowd its own axes; the frame scrolls from here down.
const MIN_WIDTH = 200;

/** @type {WeakSet<Element>} */
const started = new WeakSet();

/**
 * Enhances every Prelum chart under `root` and redraws each to its frame's width while the page lives. Calling it again is safe:
 * a chart is enhanced once.
 *
 * @param {ParentNode} [root]
 * @param {import("enarratio/enhance").EnhanceOptions} [options] passed to Enarratio's `enhance`
 * @returns {Array<{ frame: HTMLElement, destroy(): void }>}
 */
export function enhanceCharts(root = document, options = {}) {
  /** @type {Array<{ frame: HTMLElement, destroy(): void }>} */
  const out = [];
  for (const frame of Array.from(root.querySelectorAll(".cap-chart[data-prelum-chart]"))) {
    if (!(frame instanceof HTMLElement) || started.has(frame)) continue;
    started.add(frame);
    out.push(attach(frame, options));
  }
  return out;
}

/**
 * @param {HTMLElement} frame
 * @param {import("enarratio/enhance").EnhanceOptions} options
 */
function attach(frame, options) {
  /** @type {any} */
  let spec = null;
  try {
    spec = JSON.parse(frame.dataset.prelumChart ?? "null");
  } catch {
    spec = null;
  }
  const original = frame.querySelector(".enarratio-frame")?.outerHTML ?? "";
  let charts = enhance(frame, options);
  let drawn = "original";
  /** @type {number | undefined} */
  let pending;

  const redraw = () => {
    pending = undefined;
    const host = frame.querySelector(".enarratio-frame");
    const box = host?.parentElement;
    if (!host || !box || !spec || !original) return;
    const width = Math.floor(box.clientWidth);
    const { markup, key } = drawing(spec, width, original);
    if (key === drawn) return;
    const next = new DOMParser().parseFromString(markup, "text/html").body.querySelector(".enarratio-frame");
    if (!next) return;
    for (const chart of charts) chart.destroy();
    host.replaceWith(document.adoptNode(next));
    drawn = key;
    charts = enhance(frame, options);
  };
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
    if (pending === undefined) pending = requestAnimationFrame(redraw);
  });
  observer?.observe(frame);
  redraw();

  return {
    frame,
    destroy() {
      observer?.disconnect();
      if (pending !== undefined) cancelAnimationFrame(pending);
      for (const chart of charts) chart.destroy();
    },
  };
}

/**
 * The frame markup for a width, and a key that is the same when the drawing would be.
 *
 * @param {any} spec
 * @param {number} width
 * @param {string} original
 * @returns {{ markup: string, key: string }}
 */
function drawing(spec, width, original) {
  const full = Number(spec.options?.width ?? 0);
  if (typeof spec.narrow === "string") {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return width < WIDE_REM * rem ? { markup: spec.narrow, key: "narrow" } : { markup: original, key: "original" };
  }
  const draw = DRAW[/** @type {keyof typeof DRAW} */ (spec.chart)];
  if (!draw || width >= full || width < MIN_WIDTH) return { markup: original, key: "original" };
  const html = draw({ ...spec.options, width, onIssue: () => {} });
  const start = html.indexOf('<div class="enarratio-frame');
  const end = html.indexOf("</svg></div>", start);
  if (start === -1 || end === -1) return { markup: original, key: "original" };
  return { markup: html.slice(start, end + "</svg></div>".length), key: String(width) };
}
