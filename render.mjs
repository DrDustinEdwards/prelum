// The markdown pipeline with math: render-nomath.mjs's pipeline, with remark-math, a KaTeX check of every expression and rehype-katex
// passed in. KaTeX is imported only here, so a site that imports `render/nomath` never bundles it.

import katex from "katex";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { visit } from "unist-util-visit";

import { ContentError, errorMessage } from "./render-error.mjs";
import { KATEX_OPTIONS } from "./render-math.mjs";
import { renderWith } from "./render-nomath.mjs";

export { ContentError, DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, RENDER_VERSION, isAllowedUrl } from "./render-nomath.mjs";

/**
 * The AST-side owner of hasMath; a site compares it with htmlHasMath over its corpus.
 *
 * @param {string} file
 * @param {{ value: boolean }} sink set to true when the post carries any math
 */
function remarkMathValidate(file, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "inlineMath" && node.type !== "math") return;
      sink.value = true;

      const expression = String(/** @type {any} */ (node).value ?? "");
      const line = node.position?.start?.line;
      try {
        // The same KATEX_OPTIONS rehype-katex gets, so passing here proves its catch branch unreachable.
        katex.renderToString(expression, {
          ...KATEX_OPTIONS,
          displayMode: node.type === "math",
          throwOnError: true,
        });
      } catch (error) {
        const detail = errorMessage(error);
        // A line of the BODY: the tree is parsed without frontmatter, and an editor preview has no file.
        throw new ContentError(
          file,
          `KaTeX cannot render ${node.type === "math" ? "the display" : "the inline"} ` +
            `expression${line ? ` on line ${line} of the body` : ""}: ${detail}. ` +
            `The expression is: ${expression.trim()}`,
        );
      }
    });
  };
}

/**
 * Markdown in, a safe HTML fragment out, with `$…$` and `$$…$$` as math.
 *
 * @param {import("./render-nomath.mjs").RenderInput} input
 */
export function render(input) {
  // Option 3 in render-nomath.mjs's header: KATEX_OPTIONS leaves `trust` off.
  return renderWith(input, { parse: remarkMath, validate: remarkMathValidate, html: rehypeKatex, options: KATEX_OPTIONS });
}
