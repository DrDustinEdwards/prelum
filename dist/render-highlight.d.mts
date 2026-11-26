/** @typedef {Parameters<typeof createOnigurumaEngine>[0]} Wasm what the Oniguruma engine loads: a wasm module or an instantiator over one */
/**
 * @param {object} [input]
 * @param {() => Wasm | Promise<Wasm>} [input.wasm] Injected: a Worker refuses WebAssembly.instantiate() on bytes, so it passes an
 *   instantiator over a statically imported module. The engine is the same, so the HTML is byte-identical. Default is shiki's own.
 * @param {Record<string, import("shiki/core").LanguageInput>} [input.languages] name to grammar; default is the ten in GRAMMARS
 * @returns {import("./render.mjs").HighlightOptions}
 */
export function createHighlight({ wasm, languages }?: {
    wasm?: (() => Wasm | Promise<Wasm>) | undefined;
    languages?: Record<string, import("@shikijs/types").LanguageInput> | undefined;
}): import("./render.mjs").HighlightOptions;
export const LANGUAGES: string[];
export namespace SHIKI_THEMES {
    export { githubLight as light };
    export { githubDark as dark };
}
/**
 * what the Oniguruma engine loads: a wasm module or an instantiator over one
 */
export type Wasm = Parameters<typeof createOnigurumaEngine>[0];
declare const githubLight: any;
declare const githubDark: any;
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
export {};
