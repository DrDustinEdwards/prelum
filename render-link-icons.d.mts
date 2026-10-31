/** Where the icons are served unless the site says otherwise: `/link-icons/<host>.<ext>`. */
export const LINK_ICON_PATH: "/link-icons";
/** An icon over this is refused: a favicon.ico with 16 to 256 pixel images is about 30 KB. */
export const LINK_ICON_MAX_BYTES: number;
/** Each request gives up after this, so a slow host costs a publish at most a few seconds. */
export const LINK_ICON_TIMEOUT_MS: number;
/**
 * The type the bytes are, by their signature, whatever the header said: PNG, ICO, GIF, JPEG, WebP, or an SVG with nothing in it
 * that could run or load. Null for anything else.
 *
 * @param {Uint8Array} bytes
 */
export function linkIconType(bytes: Uint8Array): string | null;
/** The icon is shown at 16 CSS pixels; 32 covers a 2x screen. */
export const LINK_ICON_SIZE: 32;
/**
 * An icon no bigger than it is shown needs to be: a PNG over LINK_ICON_SIZE is shrunk to it, and a favicon.ico keeps only the
 * smallest size that covers it (as a PNG when that one is). Anything else, or anything it cannot read, comes back as it was.
 */
export function fitLinkIcon(icon: { bytes: Uint8Array; type: string }): Promise<{ bytes: Uint8Array; type: string }>;
/**
 * The stored icon's type for a host, fetching it once from the host (/favicon.ico, then its home page's `<link rel="icon">`) and
 * storing it on a miss; null when the host has none the step will serve. Never throws.
 *
 * @param {string} host a bare host name
 * @param {LinkIconOptions} options
 */
export function lookupLinkIcon(host: string, options: LinkIconOptions): Promise<string | null>;
/**
 * Where the page finds a host's icon: `<path>/<host>.<ext>`.
 *
 * @param {string} path
 * @param {string} host
 * @param {string} type
 */
export function linkIconSrc(path: string, host: string, type: string): string;
/**
 * The route: the stored icon with a year's immutable cache, nosniff and a sandboxing policy; a 404 for a host with no icon or the
 * wrong extension; null when the path is not under `path`.
 *
 * @param {string} pathname
 * @param {Pick<LinkIconStore, "get">} store
 * @param {{ path?: string }} [options]
 */
export function linkIconResponse(pathname: string, store: Pick<LinkIconStore, "get">, options?: { path?: string }): Promise<Response | null>;
/**
 * The site's own storage. A host with no usable icon is put with no bytes and an empty type, so it is not fetched again; delete
 * the entry to try it again.
 */
export type LinkIconStore = {
    get: (host: string) => Promise<{ bytes: Uint8Array | ArrayBuffer; type: string } | null | undefined>;
    put: (host: string, bytes: Uint8Array, type: string) => Promise<unknown>;
};
export type LinkIconOptions = {
    store: LinkIconStore;
    /** Where the site serves them, `/link-icons` unless given. The path `linkIconResponse` is given too. */
    path?: string;
    /** The fetch to use; the global one unless given (a test passes a fake). */
    fetch?: typeof fetch;
    /** LINK_ICON_MAX_BYTES unless given. */
    maxBytes?: number;
    /** LINK_ICON_TIMEOUT_MS unless given. */
    timeoutMs?: number;
};
