/**
 * The frontmatter every Markdown source opens with, between `---` lines, read and written without a YAML parser, so it runs
 * in a Worker and a browser alike. The header is read as top-level blocks (a key line and the lines that belong to it): a
 * value is one line of text (quotes taken off, a double-quoted value read as JSON), a flow list `[a, b]` or `- item` lines.
 * A write replaces only the block it names, so every other block, comment and unknown key comes back byte for byte.
 *
 * One reader for every site and package: `frontmatter` for a file read whole (Capsomer's doc pages, the specimen), the
 * block reader and writer for an editor that changes one field (site-api's post fields, Carrel's field boxes). Moved here
 * from site-api 0.17.0, which re-exports it.
 */

const FENCE = /^(---[ \t]*\r?\n)([\s\S]*?)(\r?\n---[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*|$))/;
const KEY = /^([A-Za-z_][\w-]*):(.*)$/;

/**
 * Cuts a source into its frontmatter text, its body and the fences between, so `open + front + close + body` is the source.
 * Blank lines after the closing fence go with the fence, so the body starts at its first line of text.
 * @param {string} source
 * @returns {import("./frontmatter.d.mts").Split}
 */
export function splitSource(source) {
  const m = FENCE.exec(source);
  if (!m) return { front: null, body: source, open: "", close: "" };
  return { front: m[2] ?? "", body: source.slice(m[0].length), open: m[1] ?? "", close: m[3] ?? "" };
}

/**
 * The source again from its parts.
 * @param {import("./frontmatter.d.mts").Split} s
 */
export function joinSource(s) {
  return s.front === null ? s.body : `${s.open}${s.front}${s.close}${s.body}`;
}

/** @typedef {{ key: string | null, lines: string[] }} Block */

/**
 * @param {string} front
 * @returns {Block[]}
 */
function blocks(front) {
  /** @type {Block[]} */
  const out = [];
  // A CRLF source reads like an LF one: a key line with a CR on it is still a key line.
  for (const line of front.split(/\r?\n/)) {
    const m = KEY.exec(line);
    const last = out[out.length - 1];
    if (m) out.push({ key: m[1] ?? "", lines: [line] });
    else if (last) last.lines.push(line);
    else out.push({ key: null, lines: [line] });
  }
  return out;
}

/** @param {string} raw */
function unquote(raw) {
  const v = raw.trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    try {
      return /** @type {string} */ (JSON.parse(v));
    } catch {
      return v.slice(1, -1);
    }
  }
  if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** @param {Block} block */
const valueOf = (block) => KEY.exec(block.lines[0] ?? "")?.[2]?.trim() ?? "";

/**
 * @param {Block} block
 * @returns {string[]}
 */
function listOf(block) {
  const first = valueOf(block);
  if (first.startsWith("[") && first.endsWith("]")) {
    return first.slice(1, -1).split(",").map(unquote).filter(Boolean);
  }
  return block.lines
    .slice(1)
    .map((l) => /^\s*-\s+(.*)$/.exec(l)?.[1])
    .filter((v) => v !== undefined)
    .map(unquote);
}

/**
 * One top-level key's value as one line of text, or "" when the frontmatter lacks it.
 * @param {string | null} front
 * @param {string} key
 */
export function readKey(front, key) {
  if (front === null) return "";
  const block = blocks(front).find((b) => b.key === key);
  return block ? unquote(valueOf(block)) : "";
}

/**
 * One top-level key's list, flow (`[a, b]`) or block (`- a` lines), unquoted and in order; [] when the frontmatter lacks it.
 * @param {string | null} front
 * @param {string} key
 * @returns {string[]}
 */
export function readList(front, key) {
  if (front === null) return [];
  const block = blocks(front).find((b) => b.key === key);
  return block ? listOf(block) : [];
}

/**
 * The frontmatter with a top-level key set to a raw value (`draft: true`), added at the end when absent. Every other block
 * is returned as it was.
 * @param {string} front
 * @param {string} key
 * @param {string} raw
 */
export function setRawKey(front, key, raw) {
  return setBlock(front, key, [`${key}: ${raw}`]);
}

/**
 * The frontmatter with one top-level key's block replaced by these lines (its key line first), added at the end when
 * absent, and removed when `lines` is empty. A block that already reads exactly so is left as it was, and every other
 * block is returned as it was.
 * @param {string} front
 * @param {string} key
 * @param {string[]} lines
 */
export function setBlock(front, key, lines) {
  // Edited as LF and written back in the source's own line ending.
  const crlf = front.includes("\r\n");
  const all = blocks(front);
  const at = all.findIndex((b) => b.key === key);
  if (at >= 0) {
    const now = all[at]?.lines ?? [];
    if (now.length === lines.length && now.every((l, i) => l === lines[i])) return front;
    if (lines.length > 0) all[at] = { key, lines };
    else all.splice(at, 1);
  } else if (lines.length > 0) {
    all.push({ key, lines });
  } else {
    return front;
  }
  return all.flatMap((b) => b.lines).join(crlf ? "\r\n" : "\n");
}

/**
 * A whole file's frontmatter as data: each top-level key's value, a list where the key holds one (`[a, b]`, `- item`
 * lines, or nothing after the colon) and one line of text otherwise. Line endings are read as LF.
 * @param {string} source the whole file
 * @returns {{ data: Record<string, string | string[]>, body: string }} `body` is the file after the closing `---` and the
 *   blank lines after it, or the whole file when it has no frontmatter
 */
export function frontmatter(source) {
  const { front, body } = splitSource(source.replace(/\r\n/g, "\n"));
  if (front === null) return { data: {}, body: source };
  /** @type {Record<string, string | string[]>} */
  const data = {};
  for (const block of blocks(front)) {
    if (block.key === null) continue;
    const value = valueOf(block);
    const list = value === "" || (value.startsWith("[") && value.endsWith("]"));
    data[block.key] = list ? listOf(block) : unquote(value);
  }
  return { data, body };
}
