// The limits that keep a hostile source from exhausting time or the stack: a byte cap, a nesting depth and a scan for the shapes
// that parse in quadratic time.

import { ContentError } from "./render-error.mjs";

/** A source over this is refused before it is parsed: a 200,000-character bracket run took 2.8 s, which a Worker cannot be sent. */
export const DEFAULT_MAX_BYTES = 512 * 1024;

/** The deepest nesting of markdown nodes allowed (lists in quotes in lists), so a hostile source cannot recurse the stack. */
export const DEFAULT_MAX_DEPTH = 100;

export const encoder = new TextEncoder();

/** Most reference-style links (`][`), emphasis delimiters (`*`, `_`) and `[` a source may hold outside code: parsing them is quadratic, so a
 * 300 KB run of `[a][a]` took 46 s. Generous for prose: a 512 KB article holds far fewer. A page of
 * `snake_case` names can hold more (every `*` and `_` counts, in a code span too), and raises them with the `scanLimits` option. */
export const DEFAULT_SCAN_LIMITS = { references: 2000, emphasis: 8000, brackets: 10000 };

/**
 * A cheap pass over the source before it is parsed, refusing the shapes that exhaust time or the stack under the byte cap: a line with more
 * than maxDepth block-quote markers in a row, a list indented deeper than maxDepth levels, and runs of reference links or emphasis
 * delimiters. Fenced code is skipped. Linear in the source.
 *
 * @param {string} file
 * @param {string} body
 * @param {number} maxDepth
 * @param {typeof DEFAULT_SCAN_LIMITS} limits
 */
export function assertScan(file, body, maxDepth, limits) {
  let fence = "";
  let references = 0;
  let emphasis = 0;
  let brackets = 0;
  let lineNo = 0;
  for (const line of body.split("\n")) {
    lineNo += 1;
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (open && open[0] === fence[0] && open.length >= fence.length) fence = "";
      continue;
    }
    if (open) {
      fence = open;
      continue;
    }
    const quote = /^(?:[ \t]*>)+/.exec(line)?.[0];
    if (quote && quote.replace(/[ \t]/g, "").length > maxDepth) {
      throw new ContentError(
        file,
        `markdown is nested more than ${maxDepth} levels deep at line ${lineNo} of the body`,
      );
    }
    const indent = /^[ \t]*(?=(?:[-*+]|\d{1,9}[.)])[ \t])/.exec(line)?.[0];
    const chained = new RegExp(`^[ \\t]*(?:(?:[-*+]|\\d{1,9}[.)])[ \\t]+){${maxDepth + 1}}`).test(
      line,
    );
    if (chained || (indent && indent.replace(/\t/g, "    ").length > maxDepth * 4)) {
      throw new ContentError(
        file,
        `markdown is nested more than ${maxDepth} levels deep at line ${lineNo} of the body`,
      );
    }
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (c === "[") {
        brackets += 1;
        if (line[i - 1] === "]") references += 1;
      } else if (c === "*" || c === "_") emphasis += 1;
    }
    if (
      references > limits.references ||
      emphasis > limits.emphasis ||
      brackets > limits.brackets
    ) {
      throw new ContentError(
        file,
        `too many links or emphasis marks (limits ${limits.references} reference links, ${limits.emphasis} emphasis marks, ${limits.brackets} brackets; the scanLimits option raises them); first exceeded at line ${lineNo} of the body`,
      );
    }
  }
}

/**
 * @param {import("mdast").Root} tree
 * @param {string} file
 * @param {number} maxDepth
 */
function assertDepth(tree, file, maxDepth) {
  /** @type {Array<[any, number]>} */
  const stack = [[tree, 1]];
  while (stack.length > 0) {
    const [node, depth] = /** @type {[any, number]} */ (stack.pop());
    if (depth > maxDepth) {
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `markdown is nested more than ${maxDepth} levels deep${line ? ` at line ${line} of the body` : ""}`,
      );
    }
    for (const child of node.children ?? []) stack.push([child, depth + 1]);
  }
}

/**
 * @param {string} file
 * @param {number} maxDepth
 */
export function remarkLimitDepth(file, maxDepth) {
  return (/** @type {import("mdast").Root} */ tree) => assertDepth(tree, file, maxDepth);
}
