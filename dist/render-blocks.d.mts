/**
 * `> [!NOTE]` and the other four, with an optional title after the marker (Obsidian's form). A role=note div, as GitHub renders them,
 * so a screen reader announces it as a note; the title is text, not a heading, so it stays out of the table of contents.
 */
export function remarkCallouts(): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * `:kbd[Ctrl]`, `:abbr[HTML]{title="HyperText Markup Language"}`, `:mark[text]`, `:sub[2]` and `:sup[2]`: the inline elements raw HTML
 * would otherwise be needed for, and raw HTML is dropped. An abbreviation without its expansion is refused: the title is the point.
 *
 * @param {string} file
 */
export function remarkInlineMarks(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
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
/**
 * `::button[Label]{href="/join"}`, Ghost's button card and WordPress's buttons block: a link styled as a button, one per line.
 * `::bookmark[Title]{url="…" description="…"}`, a link card written out by the author (or by Carrel), so the page fetches nothing.
 *
 * @param {string} file
 */
export function remarkLinkBlocks(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * :::faq, Q: and A: lines read from the block's source and shown as text in a `<dl class="faq">`.
 *
 * @param {string} file
 * @param {string} body
 */
export function remarkFaq(file: string, body: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * `::postlink[slug]` and `::postlink[slug|text]`: a link to another post by its slug, resolved by the site at render time, so a renamed
 * post's new address is written on the next render. An unknown slug stays visible as code. Every slug asked for is returned as
 * `postLinks`, which is the site's backlink index.
 *
 * @param {(slug: string) => Promise<{ url: string, title: string } | null>} resolve
 * @param {string[]} sink
 */
export function remarkPostLinks(resolve: (slug: string) => Promise<{
    url: string;
    title: string;
} | null>, sink: string[]): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => Promise<void>;
/**
 * A fence's `title="app.ts"` (Expressive Code's frame title) wraps the block in a figure with the title as its caption, so the file name
 * is read before the code. The rest of the meta is left for the highlighter's line markers.
 */
export function remarkCodeFrames(): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * The body sits under the page's own h1, so an h1 in it moves every heading down a level, and a skipped level (an h2 then an h4) is
 * returned as a warning for the editor to show: a warning, not a refusal, so an old post with an odd outline still renders.
 *
 * @param {Array<{ line: number | null, message: string }>} sink
 */
export function remarkOutline(sink: Array<{
    line: number | null;
    message: string;
}>): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
export { EMBED_PROVIDERS };
/** The directive names this module handles, added to the core's list the unknown-directive guard checks. */
export const BLOCK_DIRECTIVES: string[];
import { EMBED_PROVIDERS } from "./render-embeds.mjs";
