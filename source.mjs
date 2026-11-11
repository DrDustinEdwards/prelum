/**
 * Writing and reading a Markdown source in Prelum's dialect, for an editor that inserts blocks and checks a draft before it is
 * published (Carrel's chart dialog, figure picker and alt-text gate). Pure, so a browser editor and a server run the same code.
 * The syntax is the renderer's own: README, "Charts in posts" and "Figures".
 */

import { parseCsv } from "@dustinedwards/site-runtime/csv";
import { escapeHtml } from "@dustinedwards/site-runtime/html";

import { splitSource } from "./frontmatter.mjs";

/** The chart types a `:::chart` block takes, with their labels. */
export const CHART_KINDS = /** @type {const} */ ([
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "dot", label: "Dot" },
]);

/**
 * A CSV's column names, and which hold only numbers (the columns a chart can measure). RFC 4180 through site-runtime's reader
 * (a byte order mark dropped); a blank line is no row, and cells are trimmed.
 *
 * @param {string} csv
 * @returns {Array<{ name: string, numeric: boolean }>}
 */
export function csvColumns(csv) {
  const [names, ...table] = parseCsv(csv)
    .filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "")
    .map((r) => r.map((c) => c.trim()));
  if (!names) return [];
  return names.map((name, i) => ({
    name,
    numeric:
      table.length > 0 &&
      table.every((r) => r[i] !== undefined && r[i] !== "" && Number.isFinite(Number(r[i]))),
  }));
}

/** A directive attribute: double-quoted on one line, a quote or ampersand as a character reference. @param {string} value */
const attr = (value) => escapeHtml(value.replace(/\s+/g, " ").trim());

/**
 * A `:::chart` block: the attributes on the directive, the data as a fenced CSV block, an optional caption. An empty title or
 * caption is left out; `alt` is the finding, shown under the title and the chart's text alternative.
 *
 * @param {{ type: string, x: string, y: readonly string[], title?: string, alt: string, caption?: string, csv: string }} fields
 * @returns {string}
 */
export function chartBlock({ type, x, y, title = "", alt, caption = "", csv }) {
  const attrs = [`type="${attr(type)}"`, `x="${attr(x)}"`, `y="${attr(y.join(","))}"`];
  if (title.trim()) attrs.push(`title="${attr(title)}"`);
  attrs.push(`alt="${attr(alt)}"`);
  // A fence inside the data would end the block early; CSV never needs one.
  const data = csv
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^```.*$/gm, "")
    .trim();
  return [
    `:::chart{${attrs.join(" ")}}`,
    "```csv",
    data,
    "```",
    ...(caption.trim() ? [caption.trim()] : []),
    ":::",
  ].join("\n");
}

/** A fence closes on a run of its own character at least as long, and nothing after it. @param {string} line @param {string} fence */
function closes(line, fence) {
  const run = /^(`{3,}|~{3,})\s*$/.exec(line)?.[1];
  return Boolean(run && run[0] === fence[0] && run.length >= fence.length);
}

/**
 * Each `:::chart` block in a body, with the line it starts on. A fence inside one does not end it, and a fence outside one (a
 * code sample showing the syntax) holds no chart.
 *
 * @param {string} body
 * @returns {Array<{ line: number, text: string }>}
 */
export function chartBlocks(body) {
  const lines = body.split("\n");
  /** @type {Array<{ line: number, text: string }>} */
  const found = [];
  /** @type {string | null} */
  let outer = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (outer) {
      if (closes(line, outer)) outer = null;
      continue;
    }
    const opened = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (opened) {
      outer = opened;
      continue;
    }
    if (!/^:::chart\b/.test(line)) continue;
    /** @type {string | null} */
    let fence = null;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const inner = lines[j] ?? "";
      const open = /^(`{3,}|~{3,})/.exec(inner);
      if (fence) {
        if (closes(inner, fence)) fence = null;
      } else if (open) fence = open[1] ?? null;
      else if (/^:::\s*$/.test(inner)) {
        end = j;
        break;
      }
    }
    if (end === -1) break;
    found.push({ line: i + 1, text: lines.slice(i, end + 1).join("\n") });
    i = end;
  }
  return found;
}

/** A caption on one line: a line break would end a figure's body early. @param {string} text */
const oneLine = (text) => text.trim().replace(/\s*\n\s*/g, " ");

/**
 * A URL with the characters that would end a directive attribute or a Markdown link percent-encoded (a quote, a space,
 * parentheses, angle brackets): the same address, where an entity would rely on the site's parser decoding it.
 *
 * @param {string} url
 */
const urlPart = (url) =>
  url.replace(
    /["\s()<>]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );

/**
 * An image with its alt text and, when it has one, its caption: a `:::figure` directive (the caption is its body), or with
 * `figure: false` (a site whose renderer has no figure syntax) plain Markdown with the caption as an emphasized line under it.
 * An empty alt is a decorative image: Prelum refuses `![](x)` and a figure with no alt, and reads `![""](x)` as decorative, so
 * a decorative image is always plain.
 *
 * @param {string} url
 * @param {string} alt
 * @param {{ caption?: string, figure?: boolean }} [options] `figure` default true
 * @returns {string}
 */
export function figureMarkup(url, alt, { caption = "", figure = true } = {}) {
  const text = caption.trim();
  if (figure && alt.trim())
    return [
      `:::figure{src="${urlPart(url)}" alt="${alt.trim().replace(/"/g, "&quot;")}"}`,
      ...(text ? [oneLine(text)] : []),
      ":::",
    ].join("\n");
  return `![${alt.trim().replace(/[[\]]/g, "") || '""'}](${urlPart(url)})${text ? `\n*${oneLine(text).replace(/[*_]/g, "\\$&")}*` : ""}`;
}

/**
 * Each image in a source with no alt text, or an empty one: Markdown, an HTML `<img>` and a `:::figure` directive. Code (fenced
 * blocks and inline spans) is skipped; the front matter is not body. `line` counts from the source's first line.
 *
 * @param {string} source
 * @returns {Array<{ excerpt: string, src: string, line: number }>}
 */
export function imagesWithoutAlt(source) {
  const text = source.replace(/\r\n/g, "\n");
  const { body } = splitSource(text);
  const startLine = text.slice(0, text.length - body.length).split("\n").length;
  /** @type {Array<{ excerpt: string, src: string, line: number }>} */
  const found = [];
  /** @param {string} attrs */
  const srcOf = (attrs) =>
    /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>}]+))/i
      .exec(attrs)
      ?.slice(1)
      .find((v) => v !== undefined) ?? "";
  /** @type {string | null} */
  let fence = null;
  body.split("\n").forEach((raw, i) => {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(raw)?.[1];
    if (marker && (fence === null || marker[0] === fence[0])) {
      fence = fence === null ? marker : null;
      return;
    }
    if (fence !== null) return;
    const line = raw.replace(/`[^`]*`/g, "");
    for (const m of line.matchAll(/!\[([^\]]*)\](\([^)]*\)|\[[^\]]*\])/g)) {
      if (!(m[1] ?? "").trim())
        found.push({
          excerpt: m[0],
          src: (m[2] ?? "").slice(1, -1).trim().split(/\s+/)[0] ?? "",
          line: startLine + i,
        });
    }
    for (const m of line.matchAll(/<img\b[^>]*>/gi)) {
      const alt = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0]);
      if (!alt || !(alt[1] ?? alt[2] ?? alt[3] ?? "").trim())
        found.push({ excerpt: m[0], src: srcOf(m[0]), line: startLine + i });
    }
    for (const m of line.matchAll(/^\s*:{2,}figure\{([^}]*)\}/g)) {
      const alt = /\balt\s*=\s*"([^"]*)"/.exec(m[1] ?? "");
      if (!alt || !(alt[1] ?? "").trim())
        found.push({ excerpt: m[0].trim(), src: srcOf(m[1] ?? ""), line: startLine + i });
    }
  });
  return found;
}

/**
 * A full https address with a host: what a canonical link must be for a search engine to follow it.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAbsoluteHttps(value) {
  if (/\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
}
