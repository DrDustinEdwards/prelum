// Its own module so prelum-content reads the version without loading the renderer and its optional peers.

/**
 * Bumped whenever the output changes for the same input. A site stores it beside its rendered HTML and re-renders on a mismatch; Carrel's
 * health check reads it from meta.capabilities.render. test/render-golden.test.mjs fails when the output moves and this does not.
 */
export const RENDER_VERSION = "12";
