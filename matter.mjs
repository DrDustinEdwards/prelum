/**
 * A Markdown file's YAML frontmatter as data, and data written back as frontmatter: the reader for the sites that need a whole
 * mapping (nested lists and objects, booleans, numbers, dates). `./frontmatter` is the other reader: text blocks, no parser,
 * byte-exact edits.
 *
 * YAML 1.2's core schema plus the timestamp tag, so `date: 2026-09-30` is a `Date` (UTC midnight), and
 * `yes`, `1:30` and `0777` stay what they look like. A duplicate key, an unreadable block or a header that is not a mapping
 * throws. No `eval`, no `new Function`, no tag that builds a function or a regular expression.
 */

import { parse, stringify } from "yaml";

/**
 * @typedef {object} Matter
 * @property {Record<string, unknown>} data The frontmatter's mapping; `{}` when the file has none or it holds only comments.
 * @property {string} content The file after the closing line and the one line break after it, or the whole file when it has no frontmatter.
 * @property {string} matter The frontmatter's text between the fences, `""` when the file has none.
 */

/**
 * The file's frontmatter parsed and the rest of it. A file opens its frontmatter with `---` on its first line (a byte order
 * mark is dropped; `----` is not a fence) and closes it at the first line that starts with `---`; with no closing line the
 * whole file is frontmatter and the content is empty. The one line break after the closing line is not content.
 * @param {string} source
 * @returns {Matter}
 */
export function matter(source) {
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  if (!text.startsWith("---") || text[3] === "-") return { data: {}, content: text, matter: "" };
  const rest = text.slice(3);
  const end = rest.indexOf("\n---");
  // The closing line's own CR (CRLF files) is not part of the last value.
  const block = (end === -1 ? rest : rest.slice(0, end)).replace(/\r$/, "");
  const content = end === -1 ? "" : rest.slice(end + 4).replace(/^\r?\n?/, "");
  // A header of nothing but comments is an empty mapping.
  if (block.replace(/^\s*#[^\n]+/gm, "").trim() === "") return { data: {}, content, matter: block };
  const data = parse(block, { schema: "core", customTags: ["timestamp"] });
  if (data === null || typeof data !== "object" || Array.isArray(data) || data instanceof Date)
    throw new TypeError("Frontmatter must be a YAML mapping of keys to values.");
  return { data, content, matter: block };
}

/**
 * A file from its content and data: the data as a `---` block, then the content. Empty data writes no block. Long text is not
 * folded, and a date at UTC midnight is written as the day.
 * @param {string} content
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function stringifyMatter(content, data) {
  const yaml =
    Object.keys(data).length === 0
      ? ""
      : stringify(data, null, { schema: "core", customTags: ["timestamp"], lineWidth: 0 }).trim();
  const body = content.endsWith("\n") ? content : `${content}\n`;
  return yaml === "" ? body : `---\n${yaml}\n---\n${body}`;
}
