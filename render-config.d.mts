/** @param {string} src */
export function resolveImage(src: string): Promise<{
    width: number;
    height: number;
    placeholder: string;
} | {
    width: number;
    height: number;
    placeholder?: undefined;
}>;
/** @param {string} name a file in test/fixtures/render, without .md */
export function fixture(name: string): string;
export namespace media {
    /** @param {string} raw */
    function keyOf(raw: string): string | null;
    /** @param {string} src */
    function imageProps(src: string): {
        srcSet: string;
        sizes: string;
        href: string;
    } | null;
}
export const packs: import("../render-packs.mjs").RenderPack[];
export const highlight: import("../render.mjs").HighlightOptions;
export namespace siteOptions {
    export { packs };
    export { media };
    export { highlight };
}
export const FIXTURES: string[];
