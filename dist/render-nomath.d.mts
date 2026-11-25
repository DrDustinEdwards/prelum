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
export function render(input: RenderInput): Promise<{
    html: string;
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
    images: RenderedImage[];
    videos: RenderedVideo[];
    postLinks: string[];
    words: number;
    readingMinutes: number;
    excerpt: string;
    warnings: {
        line: number | null;
        message: string;
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
}>;
/**
 * @param {RenderInput} input
 * @param {MathPlugins | null} math
 */
export function renderWith({ file, body, resolveImage, options }: RenderInput, math: MathPlugins | null): Promise<{
    html: string;
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
    images: RenderedImage[];
    videos: RenderedVideo[];
    postLinks: string[];
    words: number;
    readingMinutes: number;
    excerpt: string;
    warnings: {
        line: number | null;
        message: string;
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
}>;
export type RenderPack = import("./render-packs.mjs").RenderPack;
/**
 * What a site decides about its images; the core knows none of it.
 */
export type MediaOptions = {
    /**
     * The key a URL cites, or null when it is not media. Collected into mediaRefs.
     */
    keyOf?: ((raw: string) => string | null) | undefined;
    /**
     * Responsive attributes for an image, and the href of the link that wraps it (the unsized original). `sources` (each a MIME type, a
     * srcset and an optional media query, AVIF first) wrap the image in a <picture>; site-runtime's ./image writes them, and its GIF
     * sources under `(prefers-reduced-motion: reduce)` also give the animation a pause control. Null leaves the image as written.
     */
    imageProps?: ((src: string) => {
        srcSet?: string;
        sizes?: string;
        href?: string;
        sources?: Array<{
            type: string;
            srcSet: string;
            media?: string;
        }>;
    } | null) | undefined;
};
/**
 * What the site's resolver knows of an image: its size and placeholder, and the library's credit and license.
 */
export type ImageFacts = {
    width: number;
    height: number;
    /**
     * a base64 data: URL shown while the image loads
     */
    placeholder?: string | undefined;
    /**
     * who made it, shown under the picture and written as the ImageObject's creditText
     */
    credit?: string | undefined;
    /**
     * the terms: a URL is the ImageObject's license, words (CC BY 4.0) are shown beside the credit and written
     * as its copyrightNotice
     */
    license?: string | undefined;
};
/**
 * An image the body shows, with what an ImageObject (schema `imageObject`) and the image sitemap need;
 *  `src` as written, for the site to make absolute. A decorative image, a dark-theme twin and an embed's poster are left out.
 */
export type RenderedImage = {
    src: string;
    alt: string;
    width?: number | undefined;
    height?: number | undefined;
    creditText?: string | undefined;
    copyrightNotice?: string | undefined;
    license?: string | undefined;
};
/**
 * A video the body plays, for the page's `og:video` and VideoObject (schema `videoObject`).
 */
export type RenderedVideo = {
    /**
     * a :::video file, or an ::embed player
     */
    kind: "file" | "embed";
    /**
     * the file, or the page on the service
     */
    url: string;
    title: string;
    /**
     * the player an embed loads
     */
    embedUrl?: string | undefined;
    poster?: string | undefined;
    captions?: string | undefined;
    /**
     * the poster's
     */
    width?: number | undefined;
    height?: number | undefined;
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
    packs?: readonly import("./render-packs.mjs").RenderPack[] | undefined;
    media?: MediaOptions | undefined;
    /**
     * Without it a code block is plain <pre><code class="language-x">.
     */
    highlight?: HighlightOptions | undefined;
    /**
     * Refuse a source longer than this many UTF-8 bytes. Default 512 KB.
     */
    maxBytes?: number | undefined;
    /**
     * Refuse a source nested deeper than this. Default 100.
     */
    maxDepth?: number | undefined;
    /**
     * Most reference links (`][`), emphasis marks (`*`, `_`) and `[` outside fenced
     * code. Defaults 2,000, 8,000 and 10,000: parsing them is quadratic, so raise one only for a page that needs it.
     */
    scanLimits?: Partial<{
        references: number;
        emphasis: number;
        brackets: number;
    }> | undefined;
    /**
     * Resolves `::postlink[slug]` to the post's
     * current address and title. Without it `::postlink[…]` stays text.
     */
    postLink?: ((slug: string) => Promise<{
        url: string;
        title: string;
    } | null>) | undefined;
    /**
     * The site's origin, the family's sites and the file sizes the link
     * contract reads (render-links.mjs). Without it every kind but away and family is still written.
     */
    links?: import("./render-links.mjs").LinkOptions | undefined;
    /**
     * The store an away link's icon is kept in, fetched once from
     * the host on a miss (render-link-icons.mjs). Without it nothing is fetched and an away link has no icon.
     */
    linkIcons?: import("./render-link-icons.mjs").LinkIconOptions | undefined;
    /**
     * The page's one fetchpriority=high. A page that renders several bodies (a cover's
     * caption, a post and its notes) makes one `{ taken: false }` and passes it to each render, in page order, so only the page's first
     * image takes it; `{ taken: true }` when the page's LCP image is outside the body, or `false`, gives every body image lazy loading.
     * Without it each render's first image takes it.
     */
    priority?: false | {
        taken: boolean;
    } | undefined;
    /**
     * Curly quotes, dashes and ellipses (SmartyPants, Astro's default). On unless false.
     */
    smartPunctuation?: boolean | undefined;
    /**
     * Run the output scan on the result and
     * throw when it finds an element or attribute outside the allowlist. Off by default; `true` uses the allowlist derived from the
     * conformance corpus, an object supplies a site's own.
     */
    assertSafe?: boolean | {
        tags: ReadonlySet<string>;
        attributes: ReadonlySet<string>;
    } | undefined;
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
    options?: RenderOptions | undefined;
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
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, DEFAULT_SCAN_LIMITS } from "./render-limits.mjs";
