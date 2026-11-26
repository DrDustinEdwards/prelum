/**
 * @param {string} file
 * @param {any} node
 * @param {string} name
 * @param {string} key
 * @param {boolean} [required]
 */
export function urlAttribute(file: string, node: any, name: string, key: string, required?: boolean): string | undefined;
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
export function where(node: any, name: string): string;
export function attrsOf(node: any): Record<string, string>;
export function blockText(node: any): string;
export function element(tagName: string, properties: Record<string, unknown>, children?: any[]): any;
export function caption(children: any[]): any[];
/** The directive names this module handles, added to the core's list the unknown-directive guard checks. */
export const BLOCK_DIRECTIVES: string[];
