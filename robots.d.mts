/**
 * @typedef {object} RobotsInput
 * @property {string} origin the production origin, for the Sitemap line
 * @property {string[]} [disallow] paths no crawler is asked to fetch (admin, previews, billed endpoints)
 * @property {string[]} [allowBots] named groups; defaults to the search engines, the AI search bots and the training bots
 * @property {string[]} [denyBots] defaults to `DENIED_BOTS`
 * @property {string[]} [sitemaps] defaults to `${origin}/sitemap.xml`
 * @property {string[]} [notes] lines after the Sitemap lines, each written as a `#` comment (an llms.txt pointer, say)
 * @property {boolean} [preview] a preview or workers.dev copy: every crawler is told `Disallow: /`
 */
/**
 * robots.txt. Every named group repeats the full disallow list: a crawler that matches a named group uses only that group
 * (RFC 9309 2.2.1, and Google's documentation: groups are not combined), so a named group with a bare `Allow: /` would open
 * every path the wildcard excludes. Advisory only; the real controls stay in the site (noindex headers, POST-only routes).
 *
 * @param {RobotsInput} input
 * @returns {string}
 */
export function robotsDocument(input: RobotsInput): string;
/**
 * The family's crawler policy (Dustin, 2026-10-25): search engines and the bots that put a page in an AI answer with a link
 * are always allowed; training crawlers are allowed here so they reach Cloudflare's Pay Per Crawl price, where AI Crawl
 * Control charges or blocks them; Bytespider is denied, since it ignores payment requests and has no answer surface.
 */
export const SEARCH_ENGINE_BOTS: string[];
export const AI_SEARCH_BOTS: string[];
export const AI_TRAINING_BOTS: string[];
export const DENIED_BOTS: string[];
export type RobotsInput = {
    /**
     * the production origin, for the Sitemap line
     */
    origin: string;
    /**
     * paths no crawler is asked to fetch (admin, previews, billed endpoints)
     */
    disallow?: string[] | undefined;
    /**
     * named groups; defaults to the search engines, the AI search bots and the training bots
     */
    allowBots?: string[] | undefined;
    /**
     * defaults to `DENIED_BOTS`
     */
    denyBots?: string[] | undefined;
    /**
     * defaults to `${origin}/sitemap.xml`
     */
    sitemaps?: string[] | undefined;
    /**
     * lines after the Sitemap lines, each written as a `#` comment (an llms.txt pointer, say)
     */
    notes?: string[] | undefined;
    /**
     * a preview or workers.dev copy: every crawler is told `Disallow: /`
     */
    preview?: boolean | undefined;
};
