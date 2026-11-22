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
 * /robots.txt for a host no crawler should fetch from (an MCP door, an admin API): `DISALLOW_ALL`, never indexed itself.
 * It needs no origin and carries no bot lists, so a door's Worker gains a few hundred bytes, not the public policy.
 *
 * @returns {Response}
 */
export function privateRobotsResponse(): Response;
/**
 * @typedef {object} AiTxtInput
 * @property {string} origin the production origin
 * @property {string} name the site's name
 * @property {string} contact where a licensing request goes, an email address
 * @property {string[]} [disallow] the same list robots.txt carries
 * @property {string[]} [policy] the site's own wording of the policy, in place of the family's; a line not already a `#`
 *   comment is written as one, so edited text cannot turn into a directive
 */
/**
 * ai.txt, the family's AI usage policy in the robots.txt form: answer engines may cite and link, training rights are
 * reserved (as `TDM_RESERVATION_HEADERS` says) and licensed on request.
 *
 * @param {AiTxtInput} input
 * @returns {string}
 */
export function aiTxt({ origin, name, contact, disallow, policy }: AiTxtInput): string;
/**
 * @typedef {object} PlainTextOptions
 * @property {string} origin the site's production origin
 * @property {Request} request the request being answered: its origin differing from `origin` marks a preview
 * @property {boolean} [preview] in place of the origin comparison, for a site that knows otherwise (a Worker Preview's env var)
 * @property {Record<string, string>} [headers] added last, so a site can add a `Cache-Tag` or replace the cache lifetime
 */
/**
 * Whether a request reached a copy of the site that is not the production origin (a workers.dev URL, a Worker Preview): the
 * copy must not be crawled or indexed in place of the site.
 *
 * @param {Pick<PlainTextOptions, "origin" | "request" | "preview">} options
 */
export function isPreviewRequest({ origin, request, preview }: Pick<PlainTextOptions, "origin" | "request" | "preview">): boolean;
/**
 * The one set of headers the family's plain-text policy files carry: UTF-8 text, `PLAIN_TEXT_CACHE_CONTROL` (or `no-store`
 * on a preview, which no cache should keep), `TDM_RESERVATION_HEADERS`, and `X-Robots-Tag: noindex` where the file is for
 * machines and should not appear in search results.
 *
 * @param {string} body
 * @param {PlainTextOptions & { noindex?: boolean }} options
 * @returns {Response}
 */
export function plainTextResponse(body: string, options: PlainTextOptions & {
    noindex?: boolean;
}): Response;
/**
 * The default `#` notes robots.txt ends with: where the AI usage policy and the LLM guide live.
 *
 * @param {string} origin
 */
export function robotsNotes(origin: string): string[];
/**
 * /robots.txt as a whole response, the route every site wrote: `robotsDocument` with `robotsNotes(origin)` as the notes unless
 * the site passes its own, `Disallow: /` for every crawler when the request is a preview, and `plainTextResponse`'s headers.
 *
 * @param {Omit<RobotsInput, "preview"> & PlainTextOptions} input
 * @returns {Response}
 */
export function robotsResponse(input: Omit<RobotsInput, "preview"> & PlainTextOptions): Response;
/**
 * /ai.txt as a whole response: `aiTxt`, with `plainTextResponse`'s headers and `X-Robots-Tag: noindex`, since the file is
 * policy for machines, not a page for search results.
 *
 * @param {AiTxtInput & PlainTextOptions} input
 * @returns {Response}
 */
export function aiTxtResponse(input: AiTxtInput & PlainTextOptions): Response;
/**
 * A search engine's site-ownership file (Google Search Console's `/google<token>.html`, Bing's `/BingSiteAuth.xml`),
 * served by the Worker at exactly its path: Workers Static Assets would redirect a `.html` file to the bare path, and
 * the engine drops the property when the file stops answering 200. `type` defaults to `text/html; charset=utf-8`.
 *
 * @param {string} body the file's whole content, as the engine gave it
 * @param {string} [type]
 * @returns {Response}
 */
export function verificationFileResponse(body: string, type?: string): Response;
/**
 * The family's crawler policy: search engines and the bots that put a page in an AI answer with a link
 * are always allowed; training crawlers are allowed here so they reach Cloudflare's Pay Per Crawl price, where AI Crawl
 * Control charges or blocks them; Bytespider is denied, since it ignores payment requests and has no answer surface.
 */
export const SEARCH_ENGINE_BOTS: string[];
export const AI_SEARCH_BOTS: string[];
export const AI_TRAINING_BOTS: string[];
export const DENIED_BOTS: string[];
/**
 * @typedef {object} RobotsInput
 * @property {string} origin the production origin, for the Sitemap line
 * @property {string[]} [disallow] paths no crawler is asked to fetch (admin, previews, billed endpoints)
 * @property {string[]} [allowBots] named groups; defaults to the search engines, the AI search bots and the training bots
 * @property {string[]} [denyBots] defaults to `DENIED_BOTS`
 * @property {string[]} [sitemaps] defaults to `${origin}/sitemap.xml`
 * @property {string[]} [notes] lines after the Sitemap lines, each written as a `#` comment (an llms.txt pointer, say)
 * @property {boolean} [preview] a preview or workers.dev copy: every crawler is told `Disallow: /`
 * @property {string} [contentSignal] defaults to `CONTENT_SIGNAL`
 */
/**
 * Cloudflare's Content Signals (contentsignals.org): pages may be indexed for search and used as input to an AI answer, but
 * not used to train, the same policy ai.txt and the TDMRep header state. Written in every group, since a crawler that matches
 * a named group reads only that group.
 */
export const CONTENT_SIGNAL: "search=yes, ai-input=yes, ai-train=no";
/** robots.txt that asks every crawler to fetch nothing: a preview copy's, and a private host's. */
export const DISALLOW_ALL: "User-agent: *\nDisallow: /\n";
/**
 * The TDM Reservation Protocol header (W3C TDMRep): text and data mining rights are reserved, the EU DSM Article 4 opt-out,
 * which is what lets a training crawler be charged rather than mine for free. Every public response carries it. There is no
 * `tdm-policy`: TDMRep reads one only as ODRL JSON or an HTML page, and a plain-text ai.txt is neither.
 */
export const TDM_RESERVATION_HEADERS: {
    "tdm-reservation": string;
};
/**
 * How long a shared cache keeps robots.txt, ai.txt and llms.txt: an hour, the lifetime most of the sites chose, so a policy
 * change reaches crawlers the same day everywhere.
 */
export const PLAIN_TEXT_CACHE_CONTROL: "public, max-age=3600";
export type AiTxtInput = {
    /**
     * the production origin
     */
    origin: string;
    /**
     * the site's name
     */
    name: string;
    /**
     * where a licensing request goes, an email address
     */
    contact: string;
    /**
     * the same list robots.txt carries
     */
    disallow?: string[] | undefined;
    /**
     * the site's own wording of the policy, in place of the family's; a line not already a `#`
     * comment is written as one, so edited text cannot turn into a directive
     */
    policy?: string[] | undefined;
};
export type PlainTextOptions = {
    /**
     * the site's production origin
     */
    origin: string;
    /**
     * the request being answered: its origin differing from `origin` marks a preview
     */
    request: Request;
    /**
     * in place of the origin comparison, for a site that knows otherwise (a Worker Preview's env var)
     */
    preview?: boolean | undefined;
    /**
     * added last, so a site can add a `Cache-Tag` or replace the cache lifetime
     */
    headers?: Record<string, string> | undefined;
};
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
    /**
     * defaults to `CONTENT_SIGNAL`
     */
    contentSignal?: string | undefined;
};
