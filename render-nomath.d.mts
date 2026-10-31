/**
 * @typedef {object} RenderInput
 * @property {string} file label used in error messages
 * @property {string} body markdown with any frontmatter already stripped
 * @property {(src: string) => Promise<ImageFacts | null>} resolveImage
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
     * Responsive attributes for an image, and the href of the link that wraps it (the unsized original). `sources` (each a MIME type,
     * a srcset and an optional media query, AVIF first) wrap the image in a <picture>; site-runtime's ./image writes them, and its GIF
     * sources under `(prefers-reduced-motion: reduce)` also give the animation a pause control. Null leaves the image as written.
     */
    imageProps?: (src: string) => {
        srcSet?: string;
        sizes?: string;
        href?: string;
        sources?: Array<{ type: string; srcSet: string; media?: string }>;
    } | null;
};
/** What the site's resolver knows of an image: its size and placeholder, and the library's credit and license. */
export type ImageFacts = {
    width: number;
    height: number;
    /** A base64 data: URL shown while the image loads. */
    placeholder?: string;
    /** Who made it, shown under the picture and written as the ImageObject's creditText. */
    credit?: string;
    /** The terms: a URL is the ImageObject's license; words (CC BY 4.0) are shown beside the credit and written as its copyrightNotice. */
    license?: string;
};
/**
 * An image the body shows, with what an ImageObject (schema `imageObject`) and the image sitemap need; `src` as written, for the site
 * to make absolute. A decorative image, a dark-theme twin and an embed's poster are left out.
 */
export type RenderedImage = {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    creditText?: string;
    copyrightNotice?: string;
    license?: string;
};
/** A video the body plays, for the page's `og:video` and VideoObject (schema `videoObject`). */
export type RenderedVideo = {
    /** A :::video file, or an ::embed player. */
    kind: "file" | "embed";
    /** The file, or the page on the service. */
    url: string;
    title: string;
    /** The player an embed loads. */
    embedUrl?: string;
    poster?: string;
    captions?: string;
    /** The poster's. */
    width?: number;
    height?: number;
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
     * The site's origin, the family's sites and the file sizes the link contract reads (render-links.mjs). Without it every kind but
     * away and family is still written.
     */
    links?: import("./render-links.mjs").LinkOptions;
    /**
     * The store an away link's icon is kept in, fetched once from the host on a miss (render-link-icons.mjs). Without it nothing is
     * fetched and an away link has no icon.
     */
    linkIcons?: import("./render-link-icons.mjs").LinkIconOptions;
    /**
     * The page's one fetchpriority=high. A page that renders several bodies makes one `{ taken: false }` and passes it to each render,
     * in page order, so only the page's first image takes it; `{ taken: true }` when the page's LCP image is outside the body, or
     * `false`, gives every body image lazy loading. Without it each render's first image takes it.
     */
    priority?: { taken: boolean } | false;
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
    /** Every image the body shows, in order, with its size and rights, for the page's ImageObjects and image sitemap. */
    images: RenderedImage[];
    /** Every video the body plays, in order, for `og:video` and VideoObject. */
    videos: RenderedVideo[];
    /** An h1 moved down, a skipped heading level, an undrawn diagram, a video with no size: for the editor to show. */
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
    resolveImage: (src: string) => Promise<ImageFacts | null>;
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
