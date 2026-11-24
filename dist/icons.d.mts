/**
 * @typedef {{ name: string, shortName?: string, description?: string, themeColor: string, backgroundColor: string,
 *   startUrl?: string, id?: string, display?: "standalone" | "minimal-ui" | "browser", lang?: string }} ManifestSite
 *   `id` is the app's identity, apart from its launch URL (default `/`)
 * @typedef {{ src: string, sizes: string, type: "image/png", purpose: string }} ManifestIcon
 */
/**
 * The `<link>`s for the icons, in the shape React Router's `links` export takes. `favicon.ico` holds 16, 32 and 48 pixel
 * images (Google wants a multiple of 48); the SVG is for browsers that draw it.
 *
 * @returns {Array<{ rel: string, href: string, type?: string, sizes?: string }>}
 */
export function iconLinks(): Array<{
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
}>;
/**
 * The web app manifest, `site.webmanifest`, pointing at the icon files. `id` is the app's identity, kept apart from its
 * launch URL so a changed `start_url` is still the same installed app (W3C Web App Manifest, "id member"; web.dev
 * "Uniquely identifying PWAs with the web app manifest id property"): `/` unless the site names one.
 *
 * @param {ManifestSite} site
 * @returns {{ id: string, name: string, short_name: string, description?: string, lang?: string, start_url: string,
 *   display: string, theme_color: string, background_color: string, icons: ManifestIcon[] }}
 */
export function webManifest(site: ManifestSite): {
    id: string;
    name: string;
    short_name: string;
    description?: string;
    lang?: string;
    start_url: string;
    display: string;
    theme_color: string;
    background_color: string;
    icons: ManifestIcon[];
};
/**
 * An `.ico` file holding PNG images, one per size: the format browsers and Google read from `/favicon.ico`.
 *
 * @param {Array<{ size: number, png: Uint8Array }>} images
 * @returns {Uint8Array}
 */
export function icoFile(images: Array<{
    size: number;
    png: Uint8Array;
}>): Uint8Array;
/**
 * The live check for a site's icons, the site-wide half of `prelum-audit`: `/favicon.ico` answers an image, the home page
 * links an icon, an Apple touch icon and a manifest, and the manifest names the site, carries an id and has an icon at 192 and 512 pixels and a
 * maskable one, each of which loads.
 *
 * @param {{ origin: string, fetch: typeof fetch }} site
 * @returns {Promise<import("./audit.mjs").AuditFinding[]>}
 */
export function auditIcons({ origin, fetch: fetcher }: {
    origin: string;
    fetch: typeof fetch;
}): Promise<import("./audit.mjs").AuditFinding[]>;
/**
 * `site.webmanifest` as a whole response, the route every site wrote: `webManifest(site)` as
 * `application/manifest+json; charset=utf-8`, cached for a day. `headers` adds to those or replaces the caching.
 *
 * @param {ManifestSite} site
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function webManifestResponse(site: ManifestSite, headers?: HeadersInit): Response;
export namespace ICONS {
    let ico: "/favicon.ico";
    let svg: "/icon.svg";
    let apple: "/apple-touch-icon.png";
    let any192: "/icon-192.png";
    let any512: "/icon-512.png";
    let maskable: "/icon-maskable-512.png";
    let manifest: "/site.webmanifest";
}
/**
 * `id` is the app's identity, apart from its launch URL (default `/`)
 */
export type ManifestSite = {
    name: string;
    shortName?: string;
    description?: string;
    themeColor: string;
    backgroundColor: string;
    startUrl?: string;
    id?: string;
    display?: "standalone" | "minimal-ui" | "browser";
    lang?: string;
};
export type ManifestIcon = {
    src: string;
    sizes: string;
    type: "image/png";
    purpose: string;
};
