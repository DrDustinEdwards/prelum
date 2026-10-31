/** GitHub's five alert types, the syntax GitHub, Obsidian and Docusaurus read. */
export const CALLOUTS: readonly ["note", "tip", "important", "warning", "caution"];
/** `> [!NOTE]` and the other four, with an optional title after the marker: a role=note div. */
export function remarkCallouts(): (tree: import("mdast").Root) => void;
/** `:kbd`, `:abbr{title}`, `:mark`, `:sub` and `:sup`. */
export function remarkInlineMarks(file: string): (tree: import("mdast").Root) => void;
/** :::video (captions required unless silent) and :::audio (transcript required); a media file written as an image is refused. */
export function remarkMedia(file: string): (tree: import("mdast").Root) => void;
/** The services an embed may load (render-embeds.mjs). */
export { EMBED_PROVIDERS } from "./render-embeds.mjs";
/** `::embed[Title]{url}`: a link to the original with the player URL beside it, loaded only on a click. */
export function remarkEmbeds(file: string): (tree: import("mdast").Root) => void;
/** :::gallery: two to nine images, each with alt text; other text is the caption. */
export function remarkGallery(file: string): (tree: import("mdast").Root) => void;
/** `::button[Label]{href}` and `::bookmark[Title]{url description}`. */
export function remarkLinkBlocks(file: string): (tree: import("mdast").Root) => void;
/** The Q: and A: lines of a :::faq block. */
export function faqPairs(content: string): Array<{ question: string; answer: string }>;
/** :::faq, shown as a definition list and returned as `faq`. */
export function remarkFaq(
    file: string,
    body: string,
    sink: Array<{ question: string; answer: string }>,
): (tree: import("mdast").Root) => void;
/** `::postlink[slug]` and `::postlink[slug|text]`, resolved by the site; every slug asked for goes to `sink`. */
export function remarkPostLinks(
    resolve: (slug: string) => Promise<{ url: string; title: string } | null>,
    sink: string[],
    faq: Array<{ question: string; answer: string }>,
): (tree: import("mdast").Root) => Promise<void>;
/** A fence's `title="…"` wraps it in a figure with the title as its caption. */
export function remarkCodeFrames(): (tree: import("mdast").Root) => void;
/** An h1 in the body moves every heading down a level; skipped levels and images without alt go to `sink` as warnings. */
export function remarkOutline(sink: Array<{ line: number | null; message: string }>): (tree: import("mdast").Root) => void;
/** The directive names this module handles. */
export const BLOCK_DIRECTIVES: string[];
