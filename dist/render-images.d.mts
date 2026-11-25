/**
 * The anchor and srcset come from one decision in one visitor so they cannot disagree about a storage tier. The first image is eager
 * with fetchpriority=high: it is usually the LCP, and a page that renders several bodies passes one `priority` to all of them so only
 * the page's first takes it. The site decides, through media.imageProps, which images are responsive; an image it returns null for
 * keeps the attributes the resolver gives it and nothing more. The resolver's size also sizes a diagram, a video (from its poster) and
 * an embed's poster, and its credit and license are shown and returned for the page's ImageObjects.
 *
 * @param {string} file
 * @param {(src: string) => Promise<ImageFacts | null>} resolveImage
 * @param {Array<Promise<void>>} pending
 * @param {NonNullable<MediaOptions["imageProps"]>} imageProps
 * @param {{ taken: boolean }} priority
 * @param {{ images: RenderedImage[], videos: RenderedVideo[], warnings: Array<{ line: number | null, message: string }>, after: Array<() => void> }} sinks
 */
export function rehypeImageSources(file: string, resolveImage: (src: string) => Promise<ImageFacts | null>, pending: Array<Promise<void>>, imageProps: NonNullable<MediaOptions["imageProps"]>, priority: {
    taken: boolean;
}, sinks: {
    images: RenderedImage[];
    videos: RenderedVideo[];
    warnings: Array<{
        line: number | null;
        message: string;
    }>;
    after: Array<() => void>;
}): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
export type ImageFacts = import("./render-nomath.mjs").ImageFacts;
export type MediaOptions = import("./render-nomath.mjs").MediaOptions;
export type RenderedImage = import("./render-nomath.mjs").RenderedImage;
export type RenderedVideo = import("./render-nomath.mjs").RenderedVideo;
