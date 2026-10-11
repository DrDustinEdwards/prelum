/**
 * @param {object} [input]
 * @param {() => Promise<any> | any} [input.wasm] Injected: a Worker refuses WebAssembly.instantiate() on bytes, so it passes an
 *   instantiator over a statically imported module. The engine is the same, so the HTML is byte-identical. Default is shiki's own.
 * @param {Record<string, any>} [input.languages] name to grammar; default is the ten in GRAMMARS
 * @returns {import("./render.mjs").HighlightOptions}
 */
export function createHighlight({ wasm, languages }?: {
    wasm?: (() => Promise<any> | any) | undefined;
    languages?: Record<string, any> | undefined;
}): import("./render.mjs").HighlightOptions;
export namespace GRAMMARS {
    export { bash };
    export { css };
    export { html };
    export { javascript };
    export { json };
    export { markdown };
    export { python };
    export { sql };
    export { tsx };
    export { typescript };
}
export const LANGUAGES: string[];
export namespace SHIKI_THEMES {
    export { githubLight as light };
    export { githubDark as dark };
}
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
declare const githubLight: any;
declare const githubDark: any;
export {};
