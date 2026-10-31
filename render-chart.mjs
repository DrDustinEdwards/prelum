// Validation and CSV parsing for the :::chart directive. The drawing is Enarratio's (the site's charts
// package, as on /cv): its theme supplies the colors, and its figure carries the title, the finding,
// the summary, the source, the CSV link and the data table. The site's stylesheet is that theme.

import { areaChart, barChart, lineChart, scatterPlot } from "enarratio/plot";
import { fromHtml } from "hast-util-from-html";

import { h } from "./render-hast.mjs";

export const CHART_TYPES = ["bar", "line", "dot", "area"];

const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 360;
// The dot chart's narrow drawing, put in under 30rem and scaled to the frame: drawn at the frame a 320 px phone leaves (about 240 px), so its text keeps 12 px there.
const NARROW_WIDTH = 240;

/** The issues `strict` refuses (E4): a reader would struggle with each, and the author can fix each in the directive. */
export const STRICT_CHART_ISSUES = ["title-missing", "reading-level", "too-many-series"];

/**
 * @param {string} text
 * @returns {{ columns: string[], rows: string[][] }}
 */
function parseChartCsv(text) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.trim() !== "");

  const header = lines[0];
  if (header === undefined) throw new Error("chart data is empty");

  const parseLine = (/** @type {string} */ line) => {
    /** @type {string[]} */
    const out = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        out.push(field.trim());
        field = "";
      } else {
        field += ch;
      }
    }
    out.push(field.trim());
    return out;
  };

  const columns = parseLine(header);
  const rows = lines.slice(1).map(parseLine);

  if (rows.length === 0) throw new Error("chart data has a header but no rows");

  columns.forEach((name, i) => {
    if (name === "") throw new Error(`chart data column ${i + 1} has an empty name`);
  });
  if (new Set(columns).size !== columns.length) {
    throw new Error("chart data has duplicate column names");
  }
  rows.forEach((row, i) => {
    if (row.length !== columns.length) {
      throw new Error(
        `chart data row ${i + 1} has ${row.length} fields, expected ${columns.length}`,
      );
    }
  });

  return { columns, rows };
}

/**
 * The y columns and the label each series is drawn and keyed under, refused unless every column
 * exists and every multi-series label is present and unique.
 *
 * @param {Record<string, string>} attrs
 * @param {string[]} columns
 * @returns {{ yColumns: string[], labels: string[] }}
 */
function resolveSeries(attrs, columns) {
  if (!attrs.y) throw new Error(":::chart requires a y attribute naming a data column");
  const yColumns = attrs.y.split(",").map((s) => s.trim()).filter(Boolean);
  if (yColumns.length === 0) throw new Error(":::chart y attribute is empty");
  for (const column of yColumns) {
    if (!columns.includes(column)) {
      throw new Error(
        `:::chart y column "${column}" is not in the data (have ${columns.join(", ")})`,
      );
    }
  }

  let labels = yColumns;
  if (attrs.labels) {
    labels = attrs.labels.split(",").map((s) => s.trim());
    if (labels.length !== yColumns.length) {
      throw new Error(
        `:::chart has ${yColumns.length} series but ${labels.length} labels`,
      );
    }
  }
  if (yColumns.length > 1) {
    labels.forEach((label, i) => {
      if (!label) {
        throw new Error(
          `:::chart series ${i + 1} ("${yColumns[i]}") has an empty label; multi-series charts must label every series`,
        );
      }
    });
    if (new Set(labels).size !== labels.length) {
      throw new Error(":::chart series labels must be unique");
    }
  }
  return { yColumns, labels };
}

/**
 * The figure's words beside the drawing, from the directive's attributes (Enarratio 0.4's options):
 * a subtitle, notes, a source (linked with `source-href`), a byline and axis units.
 *
 * @param {Record<string, string>} attrs
 */
function figureWords(attrs) {
  const text = (/** @type {string} */ name) => (attrs[name] ?? "").trim();
  const source = text("source");
  const href = text("source-href");
  if (href && !source) throw new Error(":::chart source-href needs a source naming where the data come from");
  return {
    ...(text("subtitle") ? { subtitle: text("subtitle") } : {}),
    ...(text("notes") ? { notes: text("notes") } : {}),
    ...(source ? { source: href ? { name: source, href } : source } : {}),
    ...(text("byline") ? { byline: text("byline") } : {}),
    ...(text("x-unit") ? { xUnit: text("x-unit") } : {}),
    ...(text("y-unit") ? { yUnit: text("y-unit") } : {}),
  };
}

/**
 * Draws the model with Enarratio. The data is one row per x and series, keyed by "x", "series" and
 * "value"; the author's column names go back on as the axis labels. Enarratio throws for anything it
 * cannot draw (too many series, a log of zero), and that reaches the build as a ContentError.
 *
 * Returns the figure's HTML and what `render/chart-enhance` redraws it from in the browser: for bar, line
 * and area, the chart and its options, which `enarratio/lite` draws to the same SVG at any width; for dot
 * (a scatter plot, which only `enarratio/plot` draws), the drawing at 240 px, put in when the frame is narrower than 30rem.
 *
 * @param {{ type: string, alt: string, title: string, x: string, yColumns: string[], labels: string[],
 *   points: Array<{ x: string | number, series: string, value: number }>, xIsNumeric: boolean,
 *   words: Record<string, unknown>, issues: Array<{ code: string, message: string }> }} model
 * @returns {{ html: string, redraw: { chart: "bar" | "line" | "area", options: Record<string, unknown> } | { narrow: string } }}
 */
function drawChart(model) {
  const { type, alt, title, x, yColumns, labels, points, xIsNumeric, words, issues } = model;
  const multi = labels.length > 1;
  const common = {
    alt,
    ...(title ? { title } : {}),
    ...words,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    xLabel: x,
    yLabel: multi ? null : yColumns[0],
  };
  // A reader-facing problem (no title, text above grade 9, too many series) is a render warning
  // the editor shows, not a refused post, unless the site renders strictly.
  const onIssue = (/** @type {{ code: string, message: string }} */ issue) => issues.push({ code: issue.code, message: issue.message });
  const series = multi ? { series: "series", seriesDomain: labels } : {};
  // A one-series chart has no series field, so the label is the value axis' name.
  const data = multi ? points : points.map(({ x: px, value }) => ({ x: px, value }));
  const keys = { x: "x", y: "value" };
  // Cast: Enarratio keys its options on the row type's fields, which are only known here by name.
  const options = /** @type {any} */ ({ ...common, ...keys, ...series, data });

  if (type === "bar") {
    const bar = { ...options, layout: "grouped" };
    return { html: barChart({ ...bar, onIssue }), redraw: { chart: "bar", options: bar } };
  }
  // Line, area and scatter read x as a number or a date, never as a category.
  if (!xIsNumeric && type === "dot") {
    throw new Error(`:::chart type "dot" needs a numeric x column, but "${x}" is not numeric`);
  }
  if (type === "dot") {
    const narrow = scatterPlot({ ...options, width: NARROW_WIDTH, height: Math.round((DEFAULT_HEIGHT * 5) / 6), onIssue: () => {} });
    return { html: scatterPlot({ ...options, onIssue }), redraw: { narrow: frameOf(narrow) } };
  }
  const xType = xIsNumeric ? "linear" : "time";
  if (type === "area") {
    const area = { ...options, xType };
    return { html: areaChart({ ...area, onIssue }), redraw: { chart: "area", options: area } };
  }
  const line = { ...options, xType, directLabels: multi };
  return { html: lineChart({ ...line, onIssue }), redraw: { chart: "line", options: line } };
}

/**
 * The drawing's frame (`div.enarratio-frame` and its SVG) out of a figure Enarratio wrote.
 *
 * @param {string} html
 */
function frameOf(html) {
  const start = html.indexOf('<div class="enarratio-frame');
  const end = html.indexOf("</svg></div>", start);
  if (start === -1 || end === -1) throw new Error("Enarratio returned no drawing frame");
  return html.slice(start, end + "</svg></div>".length);
}

/**
 * @param {Record<string, string>} attrs
 * @param {string} csv
 * @param {{ strict?: boolean }} [options] `strict` refuses the chart on an issue in STRICT_CHART_ISSUES, where
 *   the default only reports it (E4), so an editor can block a publish on one
 */
export function buildChartModel(attrs, csv, { strict = false } = {}) {
  const type = attrs.type;
  if (!type) throw new Error(":::chart requires a type attribute");
  if (!CHART_TYPES.includes(type)) {
    throw new Error(
      `:::chart type "${type}" is not one of ${CHART_TYPES.join(", ")}`,
    );
  }

  // Required even with the data table: the table is the long description, not the accessible name.
  const alt = (attrs.alt ?? "").trim();
  if (!alt) throw new Error(`:::chart "${attrs.title ?? type}" requires an alt attribute`);

  const { columns, rows } = parseChartCsv(csv);

  const x = attrs.x;
  if (!x) throw new Error(":::chart requires an x attribute naming a data column");
  if (!columns.includes(x)) {
    throw new Error(`:::chart x column "${x}" is not in the data (have ${columns.join(", ")})`);
  }

  const { yColumns, labels } = resolveSeries(attrs, columns);

  const xIndex = columns.indexOf(x);

  // A numeric x column is a number, so Enarratio spaces it on a linear scale.
  const prepared = rows.map((row, i) => {
    const xValue = row[xIndex];
    if (xValue === undefined) {
      throw new Error(`:::chart row ${i + 1} has no "${x}" cell`);
    }
    return { row, xValue };
  });
  const xIsNumeric = prepared.every((p) => p.xValue !== "" && Number.isFinite(Number(p.xValue)));
  const asX = (/** @type {string} */ v) => (xIsNumeric ? Number(v) : v);

  /** @type {Array<{ x: string | number, series: string, value: number }>} */
  const points = [];
  prepared.forEach(({ row, xValue }, rowIndex) => {
    yColumns.forEach((column, seriesIndex) => {
      const raw = row[columns.indexOf(column)];
      const value = Number(raw);
      if (raw === undefined || raw === "" || !Number.isFinite(value)) {
        throw new Error(
          `:::chart row ${rowIndex + 1} column "${column}" is "${raw}", which is not a number`,
        );
      }
      const series = labels[seriesIndex];
      // Thrown, not defaulted: a point with an invented series name would render as a real series.
      if (series === undefined) {
        throw new Error(`:::chart has no label for series ${seriesIndex + 1}`);
      }
      points.push({ x: asX(xValue), series, value });
    });
  });

  const title = (attrs.title ?? "").trim();
  /** @type {Array<{ code: string, message: string }>} */
  const found = [];
  const words = figureWords(attrs);
  const { html, redraw } = drawChart({ type, alt, title, x, yColumns, labels, points, xIsNumeric, words, issues: found });
  const refused = strict ? found.filter((issue) => STRICT_CHART_ISSUES.includes(issue.code)) : [];
  if (refused.length > 0) {
    throw new Error(`:::chart "${title || type}": ${refused.map((issue) => issue.message).join("; ")}`);
  }
  const issues = found.map((issue) => issue.message);
  return { type, alt, title, columns, rows, html, issues, redraw };
}

/**
 * The figure Enarratio drew, as hast, in Capsomer 0.53's chart frame: the markup of its `frameHtml(figure)`,
 * `div.cap-chart > div.cap-chart-figure > figure.enarratio`, written here so Capsomer is not a dependency.
 * Parsed rather than allowDangerousHtml, which would open raw HTML in every post. Enarratio's figcaption
 * is the head (title and finding). The author's caption is the caption under the chart, where Enarratio
 * puts its own; the directive's figure takes Enarratio's classes and data attributes, so there is one figure.
 *
 * @param {ReturnType<typeof buildChartModel>} model
 * @param {any[]} captionChildren hast for an author-written caption, may be empty
 * @param {any} figure the directive's figure node, which becomes the frame
 */
export function renderChartHast(model, captionChildren, figure) {
  const drawn = fromHtml(model.html, { fragment: true }).children.find(
    (/** @type {any} */ n) => n.type === "element" && n.tagName === "figure",
  );
  if (!drawn || drawn.type !== "element") throw new Error("Enarratio returned no <figure>");

  const classes = [...(figure.properties.className ?? []), ...(drawn.properties.className ?? [])];
  const inner = h("figure", { ...drawn.properties, className: classes }, []);
  figure.tagName = "div";
  // What render/chart-enhance redraws the chart from at the frame's width; without that script the drawing is the server's.
  figure.properties = { className: ["cap-chart"], dataPrelumChart: JSON.stringify(model.redraw) };

  const isCaption = (/** @type {any} */ n) =>
    n.type === "element" && n.tagName === "p" && (n.properties.className ?? []).includes("enarratio-caption");
  const children = drawn.children.filter((/** @type {any} */ n) => !isCaption(n));
  if (captionChildren.length > 0) {
    // Under the drawing, before the summary, notes, source and data, as Enarratio places a caption.
    const after = children.findIndex(
      (/** @type {any} */ n) => n.type === "element" && (n.properties.className ?? []).some((/** @type {string} */ name) => name === "enarratio-frame"),
    );
    // A div, not Enarratio's p: the author's caption is markdown and may hold paragraphs.
    /** @type {import("hast").Element} */
    const caption = {
      type: "element",
      tagName: "div",
      properties: { className: ["enarratio-caption"] },
      children: captionChildren,
    };
    children.splice(after === -1 ? children.length : after + 1, 0, caption);
  }
  inner.children = children;
  return [h("div", { className: ["cap-chart-figure"] }, [inner])];
}

