/**
 * Markdown in, a safe HTML fragment out, with `$…$` and `$$…$$` as math.
 *
 * @param {import("./render-nomath.mjs").RenderInput} input
 */
export function render(input: import("./render-nomath.mjs").RenderInput): Promise<import("./render-nomath.mjs").RenderResult>;
export { ContentError, DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, RENDER_VERSION, isAllowedUrl } from "./render-nomath.mjs";
export type { HighlightOptions, ImageFacts, MediaOptions, RenderInput, RenderOptions, RenderPack, RenderResult, RenderedImage, RenderedVideo } from "./render-nomath.mjs";
