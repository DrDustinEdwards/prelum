/**
 * @param {object} input
 * @param {string} input.file label used in error messages
 * @param {string} input.body markdown with any frontmatter already stripped
 * @param {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>} input.resolveImage
 * @param {RenderOptions} [input.options]
 */
export function render({ file, body, resolveImage, options }: {
    file: string;
    body: string;
    resolveImage: (src: string) => Promise<{
        width: number;
        height: number;
        placeholder?: string;
    }>;
    options?: RenderOptions | undefined;
}): Promise<{
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
}>;
/**
 * Bumped whenever the output changes for the same input. A site stores it beside its rendered HTML and re-renders on a mismatch; Carrel's
 * health check reads it from meta.capabilities.render. test/render-golden.test.mjs fails when the output moves and this does not.
 */
export const RENDER_VERSION: "3";
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
    keyOf?: ((raw: string) => string | null) | undefined;
    /**
     * Responsive attributes for an
     * image, and the href of the link that wraps it (the unsized original). Null leaves the image as written.
     */
    imageProps?: ((src: string) => {
        srcSet?: string;
        sizes?: string;
        href?: string;
    } | null) | undefined;
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
     * Run the output scan on the result and
     * throw when it finds an element or attribute outside the allowlist. Off by default; `true` uses the allowlist derived from the
     * conformance corpus, an object supplies a site's own.
     */
    assertSafe?: boolean | {
        tags: ReadonlySet<string>;
        attributes: ReadonlySet<string>;
    } | undefined;
};
import { ContentError } from "./render-error.mjs";
import { isAllowedUrl } from "./render-url.mjs";
export { ContentError, isAllowedUrl };
