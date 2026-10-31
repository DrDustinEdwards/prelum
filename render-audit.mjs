// The live check for writing: what the markdown pipeline promises, read back from a deployed page. One h1 and no skipped heading level,
// unique ids, every in-page link landing on an id (the table of contents, footnotes, heading anchors), alt text and a size on every
// image, no markdown syntax leaking into the page, and stored HTML rendered by the current pipeline. Regexes over the HTML, as audit.mjs
// reads it, so the bin runs with no parser installed.

import { RENDER_VERSION } from "./render-version.mjs";

/**
 * @typedef {import("./audit.mjs").AuditPage} AuditPage
 * @typedef {import("./audit.mjs").AuditFinding} AuditFinding
 */

// Markdown that reached a reader as text: a directive fence, an alert marker, a post link the site never resolved.
const LEAKS = [
  { pattern: /(?:^|\s):::[a-z]/m, what: "a ::: directive" },
  { pattern: /\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, what: "a [!NOTE] callout marker" },
  { pattern: /(?:^|\s)::[a-z]+[[{]/m, what: "a :: directive" },
];

/** @param {string} html */
const textOf = (html) =>
  html
    .replace(/<(script|style|pre|code|template|textarea)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ");

/** @param {string} tag @param {string} name */
const attribute = (tag, name) => {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
};

/**
 * Findings for every 200 HTML page the crawl fetched. `check` names the checklist item; errors are what a reader gets wrong (a link to
 * nowhere, an image with no text alternative), warnings what reads worse.
 *
 * @param {AuditPage[]} pages
 * @param {{ renderVersion?: string }} [options] the version stored HTML must carry; this Prelum's RENDER_VERSION by default
 * @returns {AuditFinding[]}
 */
export function auditContent(pages, { renderVersion = RENDER_VERSION } = {}) {
  /** @type {AuditFinding[]} */
  const findings = [];
  for (const page of pages) {
    if (page.status !== 200 || page.html === undefined) continue;
    const html = page.html;
    /** @param {string} check @param {"error" | "warning"} severity @param {string} detail */
    const add = (check, severity, detail) => findings.push({ url: page.url, check, severity, detail });

    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
    const h1s = levels.filter((level) => level === 1).length;
    if (h1s !== 1) add("writing-h1", "error", `${h1s} h1 elements; a page has one`);
    let previous = 1;
    for (const level of levels) {
      if (level > previous + 1) add("writing-heading-order", "warning", `h${level} follows h${previous}`);
      previous = level;
    }

    const ids = [...html.matchAll(/<[a-z][^>]*\sid\s*=\s*"([^"]+)"/gi)].map((m) => m[1] ?? "");
    const idSet = new Set(ids);
    const counted = new Map();
    for (const id of ids) counted.set(id, (counted.get(id) ?? 0) + 1);
    for (const [id, count] of counted) if (count > 1) add("writing-duplicate-id", "error", `id "${id}" is on ${count} elements`);
    for (const m of html.matchAll(/<a\b[^>]*\shref\s*=\s*"#([^"]+)"/gi)) {
      let id = m[1] ?? "";
      try {
        id = decodeURIComponent(id);
      } catch {}
      if (!idSet.has(id)) add("writing-fragment", "error", `a link to #${id} lands on nothing`);
    }

    for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = m[0];
      const src = attribute(tag, "src") ?? "(no src)";
      if (attribute(tag, "alt") === null) add("writing-img-alt", "error", `image ${src} has no alt attribute`);
      if (attribute(tag, "width") === null || attribute(tag, "height") === null) add("writing-img-size", "warning", `image ${src} has no width and height, so the page shifts as it loads`);
    }

    const text = textOf(html);
    for (const leak of LEAKS) {
      const found = leak.pattern.exec(text);
      if (found) add("writing-leak", "error", `${leak.what} shows as text: "${found[0].trim().slice(0, 40)}"`);
    }

    for (const m of html.matchAll(/\sdata-render-version\s*=\s*"([^"]*)"/gi)) {
      if (m[1] !== renderVersion) add("writing-render-version", "error", `stored HTML from render version ${m[1]}; the pipeline is at ${renderVersion}`);
    }
    if (/class="heading-anchor"/.test(html) && !/\sdata-render-version\s*=/.test(html)) {
      add("writing-render-version", "warning", "rendered writing with no data-render-version on its wrapper, so an upgrade cannot be seen");
    }
  }
  return findings;
}
