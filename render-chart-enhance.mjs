// The browser half of :::chart: Enarratio's enhancement layer (keyboard walk, focus announcements, tooltips, legend filters, a
// sortable table) on every chart Prelum rendered, and a redraw to the frame's width when it is narrower than the drawing, so a
// post's chart fits a 320 px phone instead of scrolling sideways.
//
// Browser-only, nothing runs on import. A site bundles it into a same-origin script (no inline script, so a hash CSP holds) and
// calls `enhanceCharts()` once the document is parsed. Without it every chart still reads, with its table, as the server drew it.
//
// The redraw is Enarratio's `enarratio/redraw`, shared with Capsomer's chart-enhance: it reads the spec in the figure's
// `data-prelum-chart`. Bar, line and area are drawn again by `enarratio/lite`; a dot chart swaps in the 240 px drawing the server
// wrote beside it once the frame is narrower than 30rem; a line chart narrower than 400 px drops its end labels.

import { redrawChart } from "enarratio/redraw";

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
    /** @type {any} */
    let spec = null;
    try {
      spec = JSON.parse(frame.dataset.prelumChart ?? "null");
    } catch {
      spec = null;
    }
    // A spec Enarratio cannot use (none, or a chart it does not redraw) keeps the server's drawing, enhanced.
    const chart = redrawChart(frame, spec ?? { chart: "none", options: {} }, options);
    out.push({ frame, destroy: () => chart.destroy() });
  }
  return out;
}
