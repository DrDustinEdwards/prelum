// The second layer of the safe-HTML guarantee. render.mjs is safe by construction (no raw HTML pass-through, URL policy last, KaTeX
// trust off); this scans the OUTPUT with a parser, not a regex, and refuses an element or attribute outside an allowlist. The
// construction rests on options one edit could flip, so the scan is what notices when one has.
//
// The allowlist is DERIVED, not written: render-allowlist.mjs is regenerated from the conformance corpus by test/render-safe.test.mjs,
// which fails both ways (a tag or attribute in the output but not in the list, and one in the list that never appears).

import { Parser } from "htmlparser2";

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
export const LQIP_STYLE =
  /^background-image:url\("data:image\/(?:webp|png|jpeg|avif|gif);base64,[A-Za-z0-9+/=]*"\)$/;

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

/** @typedef {{ tag: string, attrs: { name: string, value: string }[] }} ReadElement */

/**
 * Every element the HTML holds, each with every attribute it was written with (a repeated one too: a browser keeps the first, and
 * the scan sees whichever it keeps), and the markup no output of the pipeline holds: a comment, declaration, processing
 * instruction or CDATA section, a raw `<` in text (the serializer always writes `&lt;`), and an element inside <title> (an SVG
 * title holds only text). htmlparser2 reads as a browser's tokenizer does: names lowercased, entities decoded with the attribute
 * rules inside values, raw text where a browser reads raw text. It builds no tree, so where a browser's tree building would put
 * the tokenizer in another state (title is raw text in HTML and markup in SVG; a <p> leaves SVG), the two readings part at a
 * <title> or another raw-text element, and every way they can part shows one of those as markup, raw `<`, or a refused
 * element. An attribute outside any element (htmlparser2 drops a second <form> whole) is read as one on `#unknown`.
 *
 * @param {string} html
 * @returns {{ elements: ReadElement[], refused: Violation[] }}
 */
function read(html) {
  /** @type {ReadElement[]} */
  const elements = [];
  /** @type {Violation[]} */
  const refused = [];
  /** @type {string[]} */
  const stack = [];
  /** @type {ReadElement | undefined} */
  let open;
  const parser = new Parser(
    {
      onopentagname(tag) {
        if (stack.includes("title")) refused.push({ kind: "markup", tag, detail: "inside title" });
        stack.push(tag);
        open = { tag, attrs: [] };
        elements.push(open);
      },
      onattribute(name, value) {
        if (!open) elements.push((open = { tag: "#unknown", attrs: [] }));
        open.attrs.push({ name, value });
      },
      onopentag() {
        open = undefined;
      },
      onclosetag() {
        stack.pop();
      },
      ontext() {
        if (html.slice(parser.startIndex, parser.endIndex + 1).includes("<"))
          refused.push({ kind: "markup", tag: "#text", detail: "raw <" });
      },
      oncomment() {
        refused.push({ kind: "comment", tag: "#comment" });
      },
      oncdatastart() {
        refused.push({ kind: "comment", tag: "#cdata" });
      },
      onprocessinginstruction() {
        refused.push({ kind: "comment", tag: "#declaration" });
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
      lowerCaseAttributeNames: true,
      recognizeCDATA: true,
    },
  );
  parser.end(html);
  return { elements, refused };
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
  const { elements: found, refused: violations } = read(html);
  let elements = 0;
  let attributes = 0;

  for (const node of found) {
    elements += 1;
    const { tag, attrs } = node;
    if (!allowlist.tags.has(tag)) violations.push({ kind: "element", tag });

    for (const { name, value } of attrs) {
      attributes += 1;
      if (name.startsWith("on")) {
        violations.push({ kind: "event-handler", tag, attribute: name });
        continue;
      }
      if (!allowlist.attributes.has(`${tag} ${name}`.toLowerCase())) {
        violations.push({ kind: "attribute", tag, attribute: name });
        continue;
      }
      const csv =
        tag === "a" &&
        name === "href" &&
        attrs.some((attr) => attr.name === "download") &&
        isCsvDownload(value);
      if (URL_ATTRIBUTES.has(name) && !isAllowedUrl(value) && !csv) {
        violations.push({ kind: "url", tag, attribute: name, detail: value.slice(0, 80) });
      }
      if (name === "srcset") {
        for (const url of srcsetUrls(value)) {
          if (!isAllowedUrl(url))
            violations.push({ kind: "url", tag, attribute: name, detail: url.slice(0, 80) });
        }
      }
      if (name === "style" && !styleIsSafe(value)) {
        violations.push({ kind: "style", tag, attribute: name, detail: value.slice(0, 80) });
      }
    }
  }

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
    .map(
      (v) =>
        `${v.kind} ${v.tag}${v.attribute ? ` ${v.attribute}` : ""}${v.detail ? ` (${v.detail})` : ""}`,
    )
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
    for (const node of read(html).elements) {
      tags.add(node.tag);
      for (const { name } of node.attrs) attributes.add(`${node.tag} ${name}`.toLowerCase());
    }
  }
  return { tags: [...tags].sort(), attributes: [...attributes].sort() };
}
