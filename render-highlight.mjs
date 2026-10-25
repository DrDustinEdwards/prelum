// Code highlighting for render.mjs, dustinedwards-info's configuration: shiki/core with an explicit language list (the full bundle took
// that site's Worker output to 14 MB), two high-contrast themes, Oniguruma, and a wasm loader the host injects. A site that wants other
// languages passes its own `languages`; a site that wants none does not pass `highlight` at all.

import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { transformerMetaHighlight } from "@shikijs/transformers";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import bash from "shiki/langs/bash.mjs";
import css from "shiki/langs/css.mjs";
import html from "shiki/langs/html.mjs";
import javascript from "shiki/langs/javascript.mjs";
import json from "shiki/langs/json.mjs";
import markdown from "shiki/langs/markdown.mjs";
import python from "shiki/langs/python.mjs";
import sql from "shiki/langs/sql.mjs";
import tsx from "shiki/langs/tsx.mjs";
import typescript from "shiki/langs/typescript.mjs";
import githubDarkHighContrast from "shiki/themes/github-dark-high-contrast.mjs";
import githubLightHighContrast from "shiki/themes/github-light-high-contrast.mjs";

export const GRAMMARS = {
  bash,
  css,
  html,
  javascript,
  json,
  markdown,
  python,
  sql,
  tsx,
  typescript,
};

export const LANGUAGES = Object.keys(GRAMMARS);

// High-contrast themes because the plain github ones failed contrast on the paper color; comments are repointed at a secondary text
// color.
const COMMENT_LIGHT = "#5C5248";
const COMMENT_DARK = "#B3A99C";

/** @param {any} theme @param {string} color */
function withCommentColor(theme, color) {
  /** @type {any[]} */
  const rules = theme.settings ?? theme.tokenColors ?? [];
  return {
    ...theme,
    settings: rules.map((/** @type {any} */ rule) => {
      const scope = Array.isArray(rule?.scope) ? rule.scope : [rule?.scope];
      if (!scope.includes("comment")) return rule;
      return { ...rule, settings: { ...rule.settings, foreground: color } };
    }),
  };
}

const githubLight = withCommentColor(githubLightHighContrast, COMMENT_LIGHT);
const githubDark = withCommentColor(githubDarkHighContrast, COMMENT_DARK);

// Exported so a site's contrast check verifies the themes actually used, not ones it imported by name.
export const SHIKI_THEMES = { light: githubLight, dark: githubDark };

/**
 * @param {object} [input]
 * @param {() => Promise<any> | any} [input.wasm] Injected: a Worker refuses WebAssembly.instantiate() on bytes, so it passes an
 *   instantiator over a statically imported module. The engine is the same, so the HTML is byte-identical. Default is shiki's own.
 * @param {Record<string, any>} [input.languages] name to grammar; default is the ten in GRAMMARS
 * @returns {import("./render.mjs").HighlightOptions}
 */
export function createHighlight({ wasm = () => import("shiki/wasm"), languages = GRAMMARS } = {}) {
  /** @type {Promise<any> | null} */
  let highlighterPromise = null;

  // A rejection is not cached: one failed wasm load would otherwise fail every render in the isolate. The caller still sees this
  // render's failure; the next render tries again. The loader is awaited before shiki sees it, because shiki keeps its first wasm
  // load for the isolate, a rejected one included.
  function getHighlighter() {
    if (!highlighterPromise) {
      const building = (async () =>
        createHighlighterCore({
          themes: [githubLight, githubDark],
          langs: Object.values(languages),
          // Oniguruma, not the JS regex engine: the JS engine was measured non-deterministic, which makes a byte comparison fail
          // at random on any post with code.
          engine: createOnigurumaEngine(await wasm()),
        }))();
      highlighterPromise = building;
      building.catch(() => {
        if (highlighterPromise === building) highlighterPromise = null;
      });
    }
    return highlighterPromise;
  }

  return {
    async plugin() {
      return [
        rehypeShikiFromHighlighter,
        await getHighlighter(),
        {
          themes: {
            light: "github-light-high-contrast",
            dark: "github-dark-high-contrast",
          },
          // Both palettes as CSS variables per token, so code follows the page theme with no script.
          defaultColor: false,
          fallbackLanguage: "text",
          // No wall-clock limit per line. Shiki's default (500 ms) stops a line early when the machine is slow, most often on the
          // first line, while Oniguruma compiles the grammar, and paints the rest of the line in the last scope's color: the same
          // post then rendered to different bytes on a busy machine than on CI. Output depends on the input alone.
          tokenizeTimeLimit: 0,
          transformers: [
            // Marked lines are in the stored HTML, so they show with JavaScript off.
            transformerMetaHighlight(),
            {
              name: "language-label",
              /** @this {any} @param {any} node */
              pre(node) {
                node.properties["data-lang"] = this.options.lang ?? "text";
              },
            },
          ],
        },
      ];
    },
  };
}
