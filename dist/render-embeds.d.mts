/**
 * The player URL when it is on a known player's origin and path, otherwise null. render/enhance checks the URL again because it reads
 * it from the live DOM.
 *
 * @param {string} src
 * @returns {string | null}
 */
export function embedPlayerUrl(src: string): string | null;
/**
 * Each service: the URL an author pastes and the player it becomes. YouTube is its no-cookie host and X's player is told not to
 * track. Only checked parts of the author's URL reach the player URL, so nothing the author wrote reaches it unescaped.
 *
 * @type {EmbedProvider[]}
 */
export const EMBED_PROVIDERS: EmbedProvider[];
/** A Bluesky post URL by handle, which the renderer refuses with how to get the DID form. */
export const BLUESKY_HANDLE: RegExp;
export type EmbedProvider = {
    /**
     * the `embed-<name>` class
     */
    name: string;
    /**
     * what the link says before the title
     */
    label: string;
    /**
     * a video goes to the render's `videos`; a video or audio gets a play button
     */
    kind: "video" | "audio" | "map" | "post";
    /**
     * the author's URL
     */
    pattern: RegExp;
    /**
     * the iframe URL, built only from the pattern's checked parts
     */
    player: (match: RegExpExecArray, url: string) => string;
    /**
     * the player's origin
     */
    origin: string;
    /**
     * the player's path prefix, checked again on a click
     */
    path: string;
};
