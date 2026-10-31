// The second layer of the safe-HTML guarantee. render.mjs is safe by construction (no raw HTML pass-through, URL policy last, KaTeX
// trust off); this scans the OUTPUT with a parser, not a regex, and refuses an element or attribute outside an allowlist. The
// construction rests on options one edit could flip, so the scan is what notices when one has.
//
// The allowlist is DERIVED, not written: render-allowlist.mjs is regenerated from the conformance corpus by test/render-safe.test.mjs,
// which fails both ways (a tag or attribute in the output but not in the list, and one in the list that never appears).

import { parseFragment } from "parse5";

import { DEFAULT_ALLOWLIST } from "./render-allowlist.mjs";
import { ContentError } from "./render-error.mjs";
import { isAllowedUrl, isCsvDownload } from "./render-url.mjs";

/** Attributes whose value is a URL, whatever the element. */
const URL_ATTRIBUTES = new Set([
  "href",
  "src",
  "xlink:href",
  "action",
  "formaction",
  "poster",
  "data",
  "background",
  "cite",
  "ping",
]);

/**
 * The one form of `style` that may carry a url(): the pipeline's own low-quality image placeholder (render-nomath.mjs, rehypeImageSources).
 * Anything else with a url() is refused.
 */
export const LQIP_STYLE = /^background-image:url\("data:image\/(?:webp|png|jpeg|avif|gif);base64,[A-Za-z0-9+/=]*"\)$/;

/**
 * The URLs in a srcset: each comma-separated candidate is a URL, then an optional descriptor.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function srcsetUrls(value) {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

/**
 * @typedef {{ tags: ReadonlySet<string>, attributes: ReadonlySet<string> }} Allowlist
 * `attributes` holds "tag attribute" pairs, one space between.
 *
 * @typedef {{ kind: string, tag: string, attribute?: string, detail?: string }} Violation
 */

/**
 * @param {string} value
 * @returns {boolean}
 */
function styleIsSafe(value) {
  if (LQIP_STYLE.test(value)) return true;
  // A CSS escape or comment can spell url( or expression( without writing it, so neither is allowed anywhere.
  if (/[\\]|\/\*/.test(value)) return false;
  return !/url\s*\(|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(value);
}

/**
 * @param {import("parse5").DefaultTreeAdapterMap["parentNode"]} root
 * @param {(node: any) => void} visitNode
 */
function walk(root, visitNode) {
  /** @type {any[]} */
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    visitNode(node);
    // <template> keeps its children under `content`.
    if (node.content) stack.push(node.content);
    for (const child of node.childNodes ?? []) stack.push(child);
  }
}

/**
 * Reads the output the way a browser would and reports what it finds. The counts say how much was read, so zero violations cannot
 * mean zero read.
 *
 * @param {string} html
 * @param {Allowlist} [allowlist]
 * @returns {{ violations: Violation[], elements: number, attributes: number }}
 */
export function scanHtml(html, allowlist = DEFAULT_ALLOWLIST) {
  /** @type {Violation[]} */
  const violations = [];
  let elements = 0;
  let attributes = 0;

  walk(parseFragment(html), (node) => {
    if (node.nodeName === "#comment") {
      violations.push({ kind: "comment", tag: "#comment" });
      return;
    }
    if (!node.tagName) return;

    elements += 1;
    const tag = node.tagName;
    if (!allowlist.tags.has(tag)) violations.push({ kind: "element", tag });

    for (const { name, value } of node.attrs) {
      attributes += 1;
      if (/^on/i.test(name)) {
        violations.push({ kind: "event-handler", tag, attribute: name });
        continue;
      }
      if (!allowlist.attributes.has(`${tag} ${name}`)) {
        violations.push({ kind: "attribute", tag, attribute: name });
        continue;
      }
      const csv = tag === "a" && name === "href" && node.attrs.some((attr) => attr.name === "download") && isCsvDownload(value);
      if (URL_ATTRIBUTES.has(name.toLowerCase()) && !isAllowedUrl(value) && !csv) {
        violations.push({ kind: "url", tag, attribute: name, detail: value.slice(0, 80) });
      }
      if (name.toLowerCase() === "srcset") {
        for (const url of srcsetUrls(value)) {
          if (!isAllowedUrl(url)) violations.push({ kind: "url", tag, attribute: name, detail: url.slice(0, 80) });
        }
      }
      if (name === "style" && !styleIsSafe(value)) {
        violations.push({ kind: "style", tag, attribute: name, detail: value.slice(0, 80) });
      }
    }
  });

  return { violations, elements, attributes };
}

/**
 * Fails closed: throws, so a save path refuses the write instead of storing HTML it could not vouch for.
 *
 * @param {string} html
 * @param {Allowlist} [allowlist]
 */
export function assertSafe(html, allowlist = DEFAULT_ALLOWLIST) {
  const { violations } = scanHtml(html, allowlist);
  if (violations.length === 0) return;
  const shown = violations
    .slice(0, 5)
    .map((v) => `${v.kind} ${v.tag}${v.attribute ? ` ${v.attribute}` : ""}${v.detail ? ` (${v.detail})` : ""}`)
    .join("; ");
  throw new ContentError(
    "(rendered output)",
    `unsafe output refused: ${violations.length} violation${violations.length === 1 ? "" : "s"}: ${shown}`,
  );
}

/**
 * The tags and "tag attribute" pairs that appear in rendered output, for deriving the allowlist.
 *
 * @param {Iterable<string>} outputs rendered HTML fragments
 * @returns {{ tags: string[], attributes: string[] }} sorted
 */
export function inventory(outputs) {
  const tags = new Set();
  const attributes = new Set();
  for (const html of outputs) {
    walk(parseFragment(html), (node) => {
      if (!node.tagName) return;
      tags.add(node.tagName);
      for (const { name } of node.attrs) attributes.add(`${node.tagName} ${name}`);
    });
  }
  return { tags: [...tags].sort(), attributes: [...attributes].sort() };
}
