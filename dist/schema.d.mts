/** @typedef {import("./schema-node.mjs").SchemaNode} SchemaNode */
/**
 * The site itself. There is no SearchAction unless `searchUrl` is given: one is a promise that the template is a working search.
 *
 * @param {{ origin: string, name: string, description?: string, searchUrl?: string, publisher?: SchemaNode }} site
 *   `searchUrl` holds `{search_term_string}` where the query goes
 */
export function website({ origin, name, description, searchUrl, publisher }: {
    origin: string;
    name: string;
    description?: string;
    searchUrl?: string;
    publisher?: SchemaNode;
}): Record<string, unknown>;
/**
 * @typedef {object} ImageInput
 * @property {string} url the image file itself, absolute
 * @property {number} [width] in pixels
 * @property {number} [height]
 * @property {string} [caption]
 * @property {string} [creditText] the name credited where the image is published
 * @property {{ name: string, type?: "Person" | "Organization" }} [creator] a Person unless `type` says Organization
 * @property {string} [copyrightNotice]
 * @property {string} [license] a page that says how the image may be used
 * @property {string} [acquireLicensePage] a page that says how to license it
 */
/**
 * An image as an ImageObject, for `primaryImageOfPage` on a page that is not an article, or one of an Article's `image`s. Its
 * rights (`creditText`, `creator`, `copyrightNotice`, `license`, `acquireLicensePage`) are written when known.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode}
 */
export function pageImage({ url, width, height, caption, creditText, creator, copyrightNotice, license, acquireLicensePage, }: ImageInput): SchemaNode;
/**
 * An image's license metadata, which Google Images shows as its credit and Licensable badge
 * (https://developers.google.com/search/docs/appearance/structured-data/image-license-metadata): null unless one of `creator`,
 * `creditText`, `copyrightNotice` or `license` is known, since Google requires one of them beside `contentUrl`. The badge
 * needs `license`, and `acquireLicensePage` is recommended with it. One node per licensable image on the page.
 *
 * @param {ImageInput} image
 * @returns {SchemaNode | null}
 */
export function imageObject(image: ImageInput): SchemaNode | null;
/**
 * An Article's `image` set: one picture cut at each of Google's three ratios (site-runtime's ./image cuts them around the focal
 * point), each with the picture's rights. A crop whose size is not its ratio is refused, so a wrong URL cannot pass as one.
 *
 * @param {Partial<Record<typeof ARTICLE_IMAGE_RATIOS[number], { url: string, width: number, height: number }>>} crops
 * @param {Omit<ImageInput, "url" | "width" | "height">} [rights] caption, credit and license, the same on every crop
 * @returns {ImageInput[]}
 */
export function articleImageSet(crops: Partial<Record<(typeof ARTICLE_IMAGE_RATIOS)[number], {
    url: string;
    width: number;
    height: number;
}>>, rights?: Omit<ImageInput, "url" | "width" | "height">): ImageInput[];
/**
 * @typedef {object} VideoInput
 * @property {string} name the video's title
 * @property {string} thumbnailUrl its poster, absolute
 * @property {Date | number | string} uploadDate
 * @property {string} [description]
 * @property {string} [contentUrl] the file, absolute (a :::video)
 * @property {string} [embedUrl] the player (an ::embed)
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [duration] ISO 8601, e.g. `PT1M33S`
 * @property {string} [transcript] the words, or a caption file's address
 */
/**
 * A VideoObject, which Google needs to show a video in results (https://developers.google.com/search/docs/appearance/structured-data/video):
 * `name`, `thumbnailUrl` and `uploadDate` are required, and one of `contentUrl` or `embedUrl` lets Google fetch it. One missing is
 * refused rather than written as a node Google would drop.
 *
 * @param {VideoInput} video
 * @returns {SchemaNode}
 */
export function videoObject({ name, thumbnailUrl, uploadDate, description, contentUrl, embedUrl, width, height, duration, transcript, }: VideoInput): SchemaNode;
/**
 * @typedef {string | ImageInput | SchemaNode} ArticleImage a URL, an image to write as an ImageObject, or a node `pageImage` built
 */
/**
 * @typedef {object} ArticleInput
 * @property {string} url
 * @property {string} headline
 * @property {string | null} [description]
 * @property {ArticleImage | ArticleImage[]} [image] Google asks for several crops, 16:9, 4:3 and 1:1 (`articleImageSet` builds
 *   them), each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and `height` are given and smaller is refused
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified]
 * @property {string[]} [tags]
 * @property {SchemaNode} [author]
 * @property {SchemaNode} [publisher]
 * @property {string} [type] `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
 */
/**
 * An article, with its dates from the same `articleDates` the Open Graph tags use. A URL image is written as it is, and an
 * `ImageInput` as `pageImage` writes it.
 *
 * @param {ArticleInput} article
 */
export function article({ url, headline, description, image, published, modified, tags, author, publisher, type, }: ArticleInput): Record<string, unknown>;
/**
 * @param {string} origin
 * @param {Array<{ name: string, path: string }>} trail from the home page down
 */
export function breadcrumbs(origin: string, trail: Array<{
    name: string;
    path: string;
}>): Record<string, unknown>;
/**
 * An ItemList of pages. An item's `description` is written when it has one, so a hub's list carries what each guide is for.
 *
 * @param {string} origin
 * @param {string} name
 * @param {Array<{ name: string, path: string, description?: string }>} items
 */
export function itemList(origin: string, name: string, items: Array<{
    name: string;
    path: string;
    description?: string;
}>): Record<string, unknown>;
export type SchemaNode = import("./schema-node.mjs").SchemaNode;
export type ImageInput = {
    /**
     * the image file itself, absolute
     */
    url: string;
    /**
     * in pixels
     */
    width?: number | undefined;
    height?: number | undefined;
    caption?: string | undefined;
    /**
     * the name credited where the image is published
     */
    creditText?: string | undefined;
    /**
     * a Person unless `type` says Organization
     */
    creator?: {
        name: string;
        type?: "Person" | "Organization";
    } | undefined;
    copyrightNotice?: string | undefined;
    /**
     * a page that says how the image may be used
     */
    license?: string | undefined;
    /**
     * a page that says how to license it
     */
    acquireLicensePage?: string | undefined;
};
export type VideoInput = {
    /**
     * the video's title
     */
    name: string;
    /**
     * its poster, absolute
     */
    thumbnailUrl: string;
    uploadDate: Date | number | string;
    description?: string | undefined;
    /**
     * the file, absolute (a :::video)
     */
    contentUrl?: string | undefined;
    /**
     * the player (an ::embed)
     */
    embedUrl?: string | undefined;
    width?: number | undefined;
    height?: number | undefined;
    /**
     * ISO 8601, e.g. `PT1M33S`
     */
    duration?: string | undefined;
    /**
     * the words, or a caption file's address
     */
    transcript?: string | undefined;
};
/**
 * a URL, an image to write as an ImageObject, or a node `pageImage` built
 */
export type ArticleImage = string | ImageInput | SchemaNode;
export type ArticleInput = {
    url: string;
    headline: string;
    description?: string | null | undefined;
    /**
     * Google asks for several crops, 16:9, 4:3 and 1:1 (`articleImageSet` builds
     * them), each at least `ARTICLE_IMAGE_MIN_PIXELS`; one whose `width` and `height` are given and smaller is refused
     */
    image?: ArticleImage | ArticleImage[] | undefined;
    published?: string | number | Date | null | undefined;
    modified?: string | number | Date | null | undefined;
    tags?: string[] | undefined;
    author?: Record<string, unknown> | undefined;
    publisher?: Record<string, unknown> | undefined;
    /**
     * `Article` unless a subtype fits better (`ScholarlyArticle`, `TechArticle`, `BlogPosting`)
     */
    type?: string | undefined;
};
import { ARTICLE_IMAGE_RATIOS } from "@dustinedwards/site-runtime/image";
export { sameAs, person, organization, podcastSeries, podcastEpisode, dataset } from "./schema-entities.mjs";
export { jsonLd, thing, graph } from "./schema-node.mjs";
