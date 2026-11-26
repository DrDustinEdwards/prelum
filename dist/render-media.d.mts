/**
 * :::video and :::audio, with the caption as the directive's content. Video requires captions (WCAG 1.2.2) unless it is marked silent, in
 * which case the content must describe it (WCAG 1.2.1: video-only needs a text alternative), and a poster, which is what a reader sees before playing and whose size the renderer gives the player so nothing shifts; audio requires
 * a transcript (WCAG 1.2.1). A video preloads metadata and audio nothing, and neither autoplays. A media file written as an image is
 * refused here, before it becomes a broken <img>.
 *
 * An image with no alt text is refused too: a missing alt is a forgotten one far more often than a decorative one. `![""](x)`, the
 * empty alt written out as HTML writes it, marks an image the reader loses nothing without.
 *
 * @param {string} file
 */
export function remarkMedia(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * `::embed[Title]{url="https://youtu.be/…" poster="/media/…"}`. It renders as a link to the original with the player URL beside it, so the
 * page makes no request to the service until a reader asks: without script the link opens the service, and render/enhance swaps it for
 * the player on a click. The link is a poster with a play button (the lite embed): the `poster`, a picture on the site's own origin,
 * never the service's thumbnail, which would tell the service who is reading; without one, the site's card. The title names the link and
 * the player's iframe, which WCAG requires, so the poster's alt is empty.
 *
 * @param {string} file
 */
export function remarkEmbeds(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * :::gallery holds two to nine images (Ghost's limit), each with alt text; any other text in it is the caption.
 *
 * @param {string} file
 */
export function remarkGallery(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
