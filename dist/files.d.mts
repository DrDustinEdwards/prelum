/**
 * @typedef {{ name: string, contact: string, policy?: string[] }} AiTxtSite
 * @typedef {object} StandardFiles
 * @property {string} origin The production origin: the Sitemap line, ai.txt's links, and what a request on another origin is a preview of.
 * @property {string[]} [disallow] What robots.txt and ai.txt both ask crawlers to leave alone.
 * @property {Partial<Omit<import("./robots.mjs").RobotsInput, "origin" | "disallow" | "preview">>} [robots] The rest of robots.txt's input (bots, sitemaps, notes, content signal).
 * @property {AiTxtSite | ((request: Request) => Promise<AiTxtSite>)} [ai] ai.txt's name and licensing contact, or a function reading them (from the site's content); no ai.txt without it.
 * @property {import("./icons.mjs").ManifestSite | ((request: Request) => Promise<import("./icons.mjs").ManifestSite>)} [manifest] site.webmanifest's fields (webManifest), or a function reading them (from the site's content); no manifest without it.
 * @property {string} [indexNowKey] The IndexNow key, served at `/<key>.txt`.
 * @property {Record<string, string>} [verification] Ownership files by exact path (`"/google0123abcd.html": "google-site-verification: google0123abcd.html"`).
 * @property {(request: Request) => boolean} [preview] Whether a request is a preview copy, for a site that knows better than the origin comparison (a Worker Preview).
 */
/**
 * The handler: the file's response, or null when the path is not a standard file.
 * @param {StandardFiles} config
 * @returns {(request: Request) => Promise<Response | null>}
 */
export function standardFiles({ origin, disallow, robots, ai, manifest, indexNowKey, verification, preview, }: StandardFiles): (request: Request) => Promise<Response | null>;
export type AiTxtSite = {
    name: string;
    contact: string;
    policy?: string[];
};
export type StandardFiles = {
    /**
     * The production origin: the Sitemap line, ai.txt's links, and what a request on another origin is a preview of.
     */
    origin: string;
    /**
     * What robots.txt and ai.txt both ask crawlers to leave alone.
     */
    disallow?: string[] | undefined;
    /**
     * The rest of robots.txt's input (bots, sitemaps, notes, content signal).
     */
    robots?: Partial<Omit<import("./robots.mjs").RobotsInput, "origin" | "preview" | "disallow">> | undefined;
    /**
     * ai.txt's name and licensing contact, or a function reading them (from the site's content); no ai.txt without it.
     */
    ai?: AiTxtSite | ((request: Request) => Promise<AiTxtSite>) | undefined;
    /**
     * site.webmanifest's fields (webManifest), or a function reading them (from the site's content); no manifest without it.
     */
    manifest?: import("./icons.mjs").ManifestSite | ((request: Request) => Promise<import("./icons.mjs").ManifestSite>) | undefined;
    /**
     * The IndexNow key, served at `/<key>.txt`.
     */
    indexNowKey?: string | undefined;
    /**
     * Ownership files by exact path (`"/google0123abcd.html": "google-site-verification: google0123abcd.html"`).
     */
    verification?: Record<string, string> | undefined;
    /**
     * Whether a request is a preview copy, for a site that knows better than the origin comparison (a Worker Preview).
     */
    preview?: ((request: Request) => boolean) | undefined;
};
