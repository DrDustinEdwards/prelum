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
export function submitIndexNow({
  origin,
  key,
  urls,
  keyLocation,
  from,
  fetch: fetcher,
}: IndexNowInput): Promise<boolean>;
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
/**
 * Submit `urls` only when the set differs from the one last submitted (a sitemap that rebuilds the whole set on each
 * request): the sorted set's SHA-256 is kept in `kv` under `hashKey` and written only once the submission went, so a
 * failed ping is tried again next time. Never throws; true when the set changed and was submitted.
 */
export function submitIndexNowIfChanged(
  input: IndexNowInput & {
    kv: {
      get(key: string): Promise<string | null>;
      put(key: string, value: string): Promise<void>;
    };
    hashKey: string;
  },
): Promise<boolean>;
/** The `/<key>.txt` file whose whole body is the key; `headers` adds to or replaces the Content-Type. */
export function keyFileResponse(key: string, headers?: HeadersInit): Response;
/** The sitemap's URLs with a lastmod within `days` (2) of `now`; every URL when the sitemap has no lastmod. */
export function recentSitemapUrls(xml: string, options?: { days?: number; now?: Date }): string[];
