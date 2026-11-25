/**
 * The type the bytes are, by their signature, whatever the header said. An SVG is text that starts with `<svg` or an XML
 * declaration, and comes back only when nothing in it could run or load: no script, event handler, foreignObject, frame, entity,
 * style import, and no link or url() that leaves the file.
 *
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function linkIconType(bytes: Uint8Array): string | null;
/**
 * An icon no bigger than it is shown needs to be. A favicon.ico holds several sizes: the smallest that covers LINK_ICON_SIZE is
 * kept, alone, and one that is a PNG is shrunk like any PNG. Other types (an SVG scales; a GIF, JPEG or WebP favicon is rare) are
 * kept as they are, as is anything this cannot read. A PNG that is absurdly large (see MAX_ICON_PIXELS) or inflates past its
 * declared size is refused: null.
 *
 * @param {{ bytes: Uint8Array, type: string }} icon
 * @returns {Promise<{ bytes: Uint8Array, type: string } | null>}
 */
export function fitLinkIcon(icon: {
    bytes: Uint8Array;
    type: string;
}): Promise<{
    bytes: Uint8Array;
    type: string;
} | null>;
/**
 * The stored icon's type for a host, fetching and storing it on a miss; null when the host has none the step will serve. A store
 * that fails is a missing icon, never a failed render.
 *
 * @param {string} host a bare host name, as rehypeLinks gives it
 * @param {LinkIconOptions} options
 * @returns {Promise<string | null>}
 */
export function lookupLinkIcon(host: string, options: LinkIconOptions): Promise<string | null>;
/**
 * Where the page finds a host's icon.
 *
 * @param {string} path
 * @param {string} host
 * @param {string} type
 */
export function linkIconSrc(path: string, host: string, type: string): string;
/**
 * The route: the stored icon for `/link-icons/<host>.<ext>`, a year's immutable cache (an icon is fetched once, so its URL never
 * holds other bytes), and `headers`, the site's set for a file it did not write: site-runtime's UPLOAD_HEADERS (nosniff and a
 * policy that lets nothing in the file run or load). Security headers are site-runtime's, so the site passes them; there is no
 * default. A 404 for a host with no icon, or an extension that is not the stored type's; null when the path is not under `path`,
 * so a site writes `return (await linkIconResponse(url.pathname, store, { headers: UPLOAD_HEADERS })) ?? next()`.
 *
 * @param {string} pathname
 * @param {Pick<LinkIconStore, "get">} store
 * @param {{ headers: Readonly<Record<string, string>>, path?: string }} options
 * @returns {Promise<Response | null>}
 */
export function linkIconResponse(pathname: string, store: Pick<LinkIconStore, "get">, { headers, path }: {
    headers: Readonly<Record<string, string>>;
    path?: string;
}): Promise<Response | null>;
/** Where the icons are served unless the site says otherwise: `/link-icons/<host>.<ext>`. */
export const LINK_ICON_PATH: "/link-icons";
/**
 * The site's own storage. A host with no usable icon is put with no bytes and an empty type, so it
 *   is not fetched again; delete the entry to try it again.
 */
export type LinkIconStore = {
    get: (host: string) => Promise<{
        bytes: Uint8Array | ArrayBuffer;
        type: string;
    } | null | undefined>;
    put: (host: string, bytes: Uint8Array, type: string) => Promise<unknown>;
};
export type LinkIconOptions = {
    store: LinkIconStore;
    /**
     * Where the site serves them, `/link-icons` unless given. The path `linkIconResponse` is given too.
     */
    path?: string | undefined;
    /**
     * The fetch to use; the global one unless given (a test passes a fake).
     */
    fetch?: typeof fetch | undefined;
    /**
     * LINK_ICON_MAX_BYTES unless given.
     */
    maxBytes?: number | undefined;
    /**
     * LINK_ICON_TIMEOUT_MS unless given.
     */
    timeoutMs?: number | undefined;
};
