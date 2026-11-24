/**
 * Click-to-play embeds. The page loads no third party until the reader asks: the link is the scriptless path and opens the
 * service. A click in a new tab or window stays a link. `enhance` calls this; a site with its own post chrome calls it alone.
 * A second call does nothing.
 *
 * @param {{ root?: string }} [options] `root` is the rendered markup (default ".prose").
 * @returns {void}
 */
export function enhanceEmbeds({ root }?: {
    root?: string;
}): void;
/**
 * Where `enhance` looks, as CSS selectors: `root` is the rendered markup (default ".prose"), `toc` the table of contents
 * (default ".post-toc") and `article` the post body the selection link measures (default ".post .prose").
 * @typedef {{ root?: string, toc?: string, article?: string }} EnhanceOptions
 */
/**
 * Decorates the rendered post. A second call does nothing.
 *
 * @param {EnhanceOptions} [options]
 * @returns {void}
 */
export function enhance(options?: EnhanceOptions): void;
/**
 * Where `enhance` looks, as CSS selectors: `root` is the rendered markup (default ".prose"), `toc` the table of contents
 * (default ".post-toc") and `article` the post body the selection link measures (default ".post .prose").
 */
export type EnhanceOptions = {
    root?: string;
    toc?: string;
    article?: string;
};
