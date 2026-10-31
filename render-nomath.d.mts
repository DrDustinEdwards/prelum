/**
 * @typedef {object} RenderInput
 * @property {string} file label used in error messages
 * @property {string} body markdown with any frontmatter already stripped
 * @property {(src: string) => Promise<{ width: number, height: number, placeholder?: string } | null>} resolveImage
 * @property {RenderOptions} [options]
 *
 * @typedef {object} MathPlugins What render.mjs passes in; without it there is no math syntax and `$` is text.
 * @property {any} parse remark-math
 * @property {(file: string, sink: { value: boolean }) => (tree: import("mdast").Root) => void} validate
 * @property {any} html rehype-katex
 * @property {object} options KATEX_OPTIONS
 */
/** @param {RenderInput} input */
export function render(input: RenderInput): Promise<RenderResult>;
/**
 * @param {RenderInput} input
 * @param {MathPlugins | null} math
 */
export function renderWith({ file, body, resolveImage, options }: RenderInput, math: MathPlugins | null): Promise<RenderResult>;
/** A source over this is refused before it is parsed: a 200,000-character bracket run took 2.8 s, which a Worker cannot be sent. */
export const DEFAULT_MAX_BYTES: number;
/** The deepest nesting of markdown nodes allowed (lists in quotes in lists), so a hostile source cannot recurse the stack. */
export const DEFAULT_MAX_DEPTH: 100;
export type RenderPack = import("./render-packs.mjs").RenderPack;
/**
 * What a site decides about its images; the core knows none of it.
 */
export type MediaOptions = {
    /**
     * The key a URL cites, or null when it is not media. Collected into mediaRefs.
     */
    keyOf?: (raw: string) => string | null;
    /**
     * Responsive attributes for an image, and the href of the link that wraps it (the unsized original). `sources` (each a MIME type
     * and a srcset, AVIF first) wrap the image in a <picture>; site-runtime's ./image writes them. Null leaves the image as written.
     */
    imageProps?: (src: string) => {
        srcSet?: string;
        sizes?: string;
        href?: string;
        sources?: Array<{ type: string; srcSet: string }>;
    } | null;
};
/**
 * Code highlighting, injected so the core does not bundle a grammar set.
 */
export type HighlightOptions = {
    /**
     * The rehype plugin and its arguments, as render-highlight.mjs builds them.
     */
    plugin: () => Promise<[unknown, ...unknown[]]>;
};
export type RenderOptions = {
    /**
     * Extra directives, in the order they run.
     */
    packs?: readonly RenderPack[];
    media?: MediaOptions;
    /**
     * Without it a code block is plain <pre><code class="language-x">.
     */
    highlight?: HighlightOptions;
    /**
     * Refuse a source longer than this many UTF-8 bytes. Default 512 KB.
     */
    maxBytes?: number;
    /**
     * Refuse a source nested deeper than this. Default 100.
     */
    maxDepth?: number;
    /**
     * Resolves `::postlink[slug]` to the post's current address and title. Without it `::postlink[…]` stays text.
     */
    postLink?: (slug: string) => Promise<{ url: string; title: string } | null>;
    /**
     * Curly quotes, dashes and ellipses (SmartyPants, Astro's default). On unless false.
     */
    smartPunctuation?: boolean;
    /**
     * Run the output scan on the result and
     * throw when it finds an element or attribute outside the allowlist. Off by default; `true` uses the allowlist derived from the
     * conformance corpus, an object supplies a site's own.
     */
    assertSafe?: boolean | {
        tags: ReadonlySet<string>;
        attributes: ReadonlySet<string>;
    };
};
/** What render returns; a pack may add fields beside these. */
export type RenderResult = {
    html: any;
    toc: {
        depth: number;
        id: string;
        text: string;
    }[];
    hasMath: boolean;
    mediaRefs: {
        key: string;
        form: string;
        detail: string | null;
    }[];
    blockedUrls: {
        file: string;
        tag: string;
        url: string;
    }[];
    renderVersion: string;
    diagrams: Array<{
        key: string;
        source: string;
    }>;
    /** Every :::faq pair, as the page shows it, for FAQPage JSON-LD. */
    faq: Array<{ question: string; answer: string }>;
    /** Every slug a ::postlink asked for, found or not: the site's backlink index. */
    postLinks: string[];
    /** Words a reader sees, counted by text.mjs's rule. */
    words: number;
    /** Minutes to read, from words and images. */
    readingMinutes: number;
    /** The first paragraph as plain text, at most 300 characters. */
    excerpt: string;
    /** An h1 moved down, a skipped heading level, an image without alt text: for the editor to show. */
    warnings: Array<{ line: number | null; message: string }>;
};
export type RenderInput = {
    /**
     * label used in error messages
     */
    file: string;
    /**
     * markdown with any frontmatter already stripped
     */
    body: string;
    resolveImage: (src: string) => Promise<{
        width: number;
        height: number;
        placeholder?: string;
    } | null>;
    options?: RenderOptions;
};
/**
 * What render.mjs passes in; without it there is no math syntax and `$` is text.
 */
export type MathPlugins = {
    /**
     * remark-math
     */
    parse: any;
    validate: (file: string, sink: {
        value: boolean;
    }) => (tree: import("mdast").Root) => void;
    /**
     * rehype-katex
     */
    html: any;
    /**
     * KATEX_OPTIONS
     */
    options: object;
};
import { ContentError } from "./render-error.mjs";
import { RENDER_VERSION } from "./render-version.mjs";
import { isAllowedUrl } from "./render-url.mjs";
export { ContentError, RENDER_VERSION, isAllowedUrl };
