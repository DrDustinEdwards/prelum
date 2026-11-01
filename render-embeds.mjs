// @ts-check
// The services `::embed` may load, shared by the renderer (render-blocks.mjs) and the click handler (render-enhance.mjs). A site's
// policy lets the players in through site-runtime's `embeds` opt-in (@dustinedwards/site-runtime/embeds, whose list the test holds
// every player here to). Dependency-free, so the browser bundle can import it.

/**
 * @typedef {object} EmbedProvider
 * @property {string} name the `embed-<name>` class
 * @property {string} label what the link says before the title
 * @property {"video" | "audio" | "map" | "post"} kind a video goes to the render's `videos`; a video or audio gets a play button
 * @property {RegExp} pattern the author's URL
 * @property {(match: RegExpExecArray, url: string) => string} player the iframe URL, built only from the pattern's checked parts
 * @property {string} origin the player's origin
 * @property {string} path the player's path prefix, checked again on a click
 */

/** @param {string | undefined} value */
const token = (value) => (value && /^[A-Za-z0-9]{1,24}$/.test(value) ? value : null);

/**
 * Amazon Music's own embed code, with only the parameters its player reads. amazon.com only: the other country sites are not in
 * site-runtime's frame list, so a player from one could not load.
 *
 * @param {string} asin
 * @param {string} url
 */
function amazonPlayer(asin, url) {
  const query = new URL(url).searchParams;
  const kept = ["id", "marketplaceId", "musicTerritory"].flatMap((key) => {
    const value = token(query.get(key) ?? undefined);
    return value ? [`${key}=${value}`] : [];
  });
  return `https://music.amazon.com/embed/${asin}/${kept.length ? `?${kept.join("&")}` : ""}`;
}

/**
 * Each service: the URL an author pastes and the player it becomes. YouTube is its no-cookie host and X's player is told not to
 * track. Only checked parts of the author's URL reach the player URL, so nothing the author wrote reaches it unescaped.
 *
 * @type {EmbedProvider[]}
 */
export const EMBED_PROVIDERS = [
  {
    name: "youtube",
    label: "Watch on YouTube",
    kind: "video",
    pattern: /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/,
    player: (m) => `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1`,
    origin: "https://www.youtube-nocookie.com",
    path: "/embed/",
  },
  {
    name: "tiktok",
    label: "Watch on TikTok",
    kind: "video",
    pattern: /^https:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]{1,24}\/video\/(\d{10,25})(?:[/?#].*)?$/,
    player: (m) => `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1`,
    origin: "https://www.tiktok.com",
    path: "/player/v1/",
  },
  {
    name: "spotify",
    label: "Listen on Spotify",
    kind: "audio",
    pattern: /^https:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})(?:[?#].*)?$/,
    player: (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
    origin: "https://open.spotify.com",
    path: "/embed/",
  },
  {
    name: "soundcloud",
    label: "Listen on SoundCloud",
    kind: "audio",
    pattern: /^https:\/\/soundcloud\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/,
    player: (_m, url) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`,
    origin: "https://w.soundcloud.com",
    path: "/player/",
  },
  {
    name: "apple-podcasts",
    label: "Listen on Apple Podcasts",
    kind: "audio",
    pattern: /^https:\/\/podcasts\.apple\.com\/([a-z]{2})\/podcast\/([A-Za-z0-9%-]{1,200})\/id(\d{5,15})(?:\?i=(\d{5,20}))?$/,
    player: (m) => `https://embed.podcasts.apple.com/${m[1]}/podcast/${m[2]}/id${m[3]}${m[4] ? `?i=${m[4]}` : ""}`,
    origin: "https://embed.podcasts.apple.com",
    path: "/",
  },
  {
    name: "amazon-music",
    label: "Listen on Amazon Music",
    kind: "audio",
    // The src of Amazon Music's Share > Embed code; Amazon's player takes an ASIN, which its page URLs do not always carry.
    pattern: /^https:\/\/music\.amazon\.com\/embed\/([A-Z0-9]{10})\/?(?:\?[^#]*)?$/,
    player: (m, url) => amazonPlayer(m[1], url),
    origin: "https://music.amazon.com",
    path: "/embed/",
  },
  {
    name: "google-maps",
    label: "View on Google Maps",
    kind: "map",
    // The src of Google Maps' Share > Embed a map code, which needs no API key.
    pattern: /^https:\/\/www\.google\.com\/maps\/embed\?pb=([A-Za-z0-9!._%~-]{10,4000})$/,
    player: (m) => `https://www.google.com/maps/embed?pb=${m[1]}`,
    origin: "https://www.google.com",
    path: "/maps/embed",
  },
  {
    name: "x",
    label: "View on X",
    kind: "post",
    pattern: /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})(?:[/?#].*)?$/,
    player: (m) => `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&dnt=true`,
    origin: "https://platform.twitter.com",
    path: "/embed/",
  },
  {
    name: "bluesky",
    label: "View on Bluesky",
    kind: "post",
    // Bluesky's player takes the account's DID, not its handle (see BLUESKY_HANDLE).
    pattern: /^https:\/\/bsky\.app\/profile\/(did:plc:[a-z2-7]{24})\/post\/([a-z2-7]{13})\/?$/,
    player: (m) => `https://embed.bsky.app/embed/${m[1]}/app.bsky.feed.post/${m[2]}`,
    origin: "https://embed.bsky.app",
    path: "/embed/",
  },
  {
    name: "instagram",
    label: "View on Instagram",
    kind: "post",
    pattern: /^https:\/\/(?:www\.)?instagram\.com\/(p|reel)\/([A-Za-z0-9_-]{5,40})\/?(?:\?.*)?$/,
    player: (m) => `https://www.instagram.com/${m[1]}/${m[2]}/embed/`,
    origin: "https://www.instagram.com",
    path: "/",
  },
];

/** A Bluesky post URL by handle, which the renderer refuses with how to get the DID form. */
export const BLUESKY_HANDLE = /^https:\/\/bsky\.app\/profile\/(?!did:)[^/]+\/post\/[a-z2-7]{13}\/?$/;

/**
 * The player URL when it is on a known player's origin and path, otherwise null. render/enhance checks the URL again because it reads
 * it from the live DOM.
 *
 * @param {string} src
 * @returns {string | null}
 */
export function embedPlayerUrl(src) {
  try {
    const url = new URL(src);
    return EMBED_PROVIDERS.some((p) => url.origin === p.origin && url.pathname.startsWith(p.path)) ? url.href : null;
  } catch {
    return null;
  }
}
