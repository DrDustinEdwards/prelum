/**
 * @typedef {object} IndexNowInput
 * @property {string} origin the production origin; IndexNow refuses a URL on any other host, so those are dropped
 * @property {string} key the site's IndexNow key, served as the whole body of `keyLocation`
 * @property {string[]} urls the changed pages
 * @property {string} [keyLocation] defaults to `${origin}/${key}.txt`
 * @property {string} [from] the URL of the request that made the change; a request on any other origin (localhost, a
 *   workers.dev preview) sends nothing
 * @property {typeof fetch} [fetch]
 */
/**
 * Tell Bing, Yandex and the other IndexNow engines that pages changed, instead of waiting for their next crawl. Never throws:
 * a network error or a non-2xx answer resolves to false, since a missed ping only means the engine finds the page on its own
 * schedule. On Workers, hand the promise to `ctx.waitUntil` so the response never waits on it.
 *
 * @param {IndexNowInput} input
 * @returns {Promise<boolean>}
 */
export function submitIndexNow({ origin: givenOrigin, key, urls, keyLocation, from, fetch: fetcher, }: IndexNowInput): Promise<boolean>;
/**
 * Submit `urls` only when the set differs from the one last submitted, for a page that rebuilds the whole set on each
 * request (a sitemap): the sorted set's SHA-256 is kept in `kv` under `hashKey`, and it is written only once the
 * submission went, so a failed ping is tried again on the next request instead of being lost. Never throws, as
 * `submitIndexNow`; true when the set changed and was submitted.
 *
 * @param {IndexNowInput & { kv: { get(key: string): Promise<string | null>, put(key: string, value: string): Promise<void> }, hashKey: string }} input
 * @returns {Promise<boolean>}
 */
export function submitIndexNowIfChanged({ kv, hashKey, ...input }: IndexNowInput & {
    kv: {
        get(key: string): Promise<string | null>;
        put(key: string, value: string): Promise<void>;
    };
    hashKey: string;
}): Promise<boolean>;
/**
 * The key file IndexNow fetches to prove the site owns its URLs: `/<key>.txt`, whose whole body is the key, with no
 * newline (IndexNow compares the body with the key and silently rejects a submission when they differ). The key is public
 * by the protocol's design, so a site commits it as a constant. `headers` adds to or replaces the Content-Type.
 *
 * @param {string} key
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function keyFileResponse(key: string, headers?: HeadersInit): Response;
/**
 * The URLs of a sitemap whose `<lastmod>` falls within `days` of `now`, for a static site that tells IndexNow after a
 * deploy which pages changed. A sitemap with no lastmod at all gives every URL: a small static site sends its whole list.
 *
 * @param {string} xml
 * @param {{ days?: number, now?: Date }} [options]
 * @returns {string[]}
 */
export function recentSitemapUrls(xml: string, { days, now }?: {
    days?: number;
    now?: Date;
}): string[];
export type IndexNowInput = {
    /**
     * the production origin; IndexNow refuses a URL on any other host, so those are dropped
     */
    origin: string;
    /**
     * the site's IndexNow key, served as the whole body of `keyLocation`
     */
    key: string;
    /**
     * the changed pages
     */
    urls: string[];
    /**
     * defaults to `${origin}/${key}.txt`
     */
    keyLocation?: string | undefined;
    /**
     * the URL of the request that made the change; a request on any other origin (localhost, a
     * workers.dev preview) sends nothing
     */
    from?: string | undefined;
    fetch?: typeof fetch | undefined;
};
