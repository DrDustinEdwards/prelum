/**
 * Markdown in, a safe HTML fragment out, with `$…$` and `$$…$$` as math.
 *
 * @param {import("./render-nomath.mjs").RenderInput} input
 * @returns {Promise<RenderResult>}
 */
export function render(input: import("./render-nomath.mjs").RenderInput): Promise<RenderResult>;
export type HighlightOptions = import("./render-nomath.mjs").HighlightOptions;
export type ImageFacts = import("./render-nomath.mjs").ImageFacts;
export type MediaOptions = import("./render-nomath.mjs").MediaOptions;
export type RenderInput = import("./render-nomath.mjs").RenderInput;
export type RenderOptions = import("./render-nomath.mjs").RenderOptions;
export type RenderPack = import("./render-nomath.mjs").RenderPack;
export type RenderResult = Awaited<ReturnType<typeof renderWith>>;
export type RenderedImage = import("./render-nomath.mjs").RenderedImage;
export type RenderedVideo = import("./render-nomath.mjs").RenderedVideo;
import { renderWith } from "./render-nomath.mjs";
export { ContentError, DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, DEFAULT_SCAN_LIMITS, RENDER_VERSION, isAllowedUrl } from "./render-nomath.mjs";
