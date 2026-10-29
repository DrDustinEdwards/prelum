/**
 * The small YAML subset the family's Markdown files open with, between `---` lines: `key: value`, `key: [a, b]`, and `key:`
 * followed by `- item` lines. Quotes around a value are taken off. Anything else (nesting, multi-line strings, numbers and
 * booleans as types) is not read: every value is a string or a list of strings, and a line that is not one of the three forms
 * is skipped. Capsomer's site and its bin each wrote this for themselves; it is theirs, moved here.
 *
 * @param {string} source the whole file
 * @returns {{ data: Record<string, string | string[]>, body: string }} `body` is the file after the closing `---`, or the
 *   whole file when it has no frontmatter
 */
export function frontmatter(source) {
  const text = source.replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { data: {}, body: source };
  /** @type {Record<string, string | string[]>} */
  const data = {};
  let key = "";
  for (const line of (match[1] ?? "").split("\n")) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      const list = data[key];
      data[key] = [...(Array.isArray(list) ? list : []), unquote(item[1] ?? "")];
      continue;
    }
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (!pair) continue;
    key = pair[1] ?? "";
    const value = (pair[2] ?? "").trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value.slice(1, -1).split(",").map((part) => unquote(part.trim())).filter(Boolean);
    } else data[key] = value === "" ? [] : unquote(value);
  }
  return { data, body: text.slice(match[0].length) };
}

/** @param {string} text */
const unquote = (text) => text.replace(/^(['"])(.*)\1$/, "$2");
