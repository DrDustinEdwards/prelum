/** One service `::embed` may load. */
export interface EmbedProvider {
    /** The `embed-<name>` class. */
    name: string;
    /** What the link says before the title. */
    label: string;
    /** A video goes to the render's `videos`; a video or audio gets a play button. */
    kind: "video" | "audio" | "map" | "post";
    /** The author's URL. */
    pattern: RegExp;
    /** The iframe URL, built only from the pattern's checked parts. */
    player: (match: RegExpExecArray, url: string) => string;
    /** The player's origin. */
    origin: string;
    /** The player's path prefix, checked again on a click. */
    path: string;
}
/** YouTube, TikTok, Spotify, SoundCloud, Apple Podcasts, Amazon Music, Google Maps, X, Bluesky and Instagram. */
export const EMBED_PROVIDERS: EmbedProvider[];
/** A Bluesky post URL by handle, which the renderer refuses with how to get the DID form. */
export const BLUESKY_HANDLE: RegExp;
/** The player URL when it is on a known player's origin and path, otherwise null. */
export function embedPlayerUrl(src: string): string | null;
