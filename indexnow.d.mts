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
export function submitIndexNow({ origin, key, urls, keyLocation, from, fetch: fetcher }: IndexNowInput): Promise<boolean>;
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
/** The `/<key>.txt` file whose whole body is the key; `headers` adds to or replaces the Content-Type. */
export function keyFileResponse(key: string, headers?: HeadersInit): Response;
