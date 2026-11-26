/**
 * @typedef {Record<string, { hash: string, lastmod: string }>} PageRecord each page's content hash and the day it last changed
 */
/**
 * When each page of a static build last changed, for the sitemap's `lastmod`. Google uses `lastmod` only when it is consistently
 * accurate (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and a build date on every page is
 * not that. So a page whose text is the same as in the record of the live build keeps the date that record gave it, a changed one
 * gets `today`, and a page the record has never seen gets `today` too, the day it was first published. The record is written to the
 * build (a `build.json`) and read back from the live site on the next one: `readPageRecord`.
 *
 * @param {Array<[string, string]>} pages each page's path and HTML
 * @param {PageRecord | undefined} previous the live build's record, or undefined when there is none yet
 * @param {string} today `YYYY-MM-DD`
 * @param {{ ignore?: string[] }} [options] text to leave out before hashing, such as a build date the pages print
 * @returns {PageRecord}
 */
export function pageDates(pages: Array<[string, string]>, previous: PageRecord | undefined, today: string, options?: {
    ignore?: string[];
}): PageRecord;
/**
 * The live build's page record: `undefined` when there is none (a 404, a missing file, a first deploy), and an error when the
 * record cannot be read, since a build that carried on would date every page today.
 *
 * @param {string} source an https address or a file path
 * @returns {Promise<PageRecord | undefined>}
 */
export function readPageRecord(source: string): Promise<PageRecord | undefined>;
/**
 * A rendered site's pages that no database row dates (its code-backed marketing, docs and hub pages), tracked by what they say:
 * run it from a cron job. Each path is read as Markdown (`read`, such as the site's own handler answering `<path>.md`), hashed
 * and compared with the record `load` returns, and `pageDates` keeps the date of every page whose text is unchanged. A path
 * `read` cannot read (it returns null) keeps the record's entry, so a page that fails to render one night is not dated today.
 * `save` is called only when the record changed.
 *
 * @param {{ paths: string[], read: (path: string) => Promise<string | null>, load: () => Promise<PageRecord | undefined>, save: (record: PageRecord) => Promise<void>, today?: string }} options
 * @returns {Promise<{ record: PageRecord, changed: boolean }>}
 */
export function trackPageDates({ paths, read, load, save, today }: {
    paths: string[];
    read: (path: string) => Promise<string | null>;
    load: () => Promise<PageRecord | undefined>;
    save: (record: PageRecord) => Promise<void>;
    today?: string;
}): Promise<{
    record: PageRecord;
    changed: boolean;
}>;
/**
 * A page record in one KV key, as `trackPageDates` loads and saves it.
 *
 * @param {{ get(key: string): Promise<string | null>, put(key: string, value: string): Promise<unknown> }} kv
 * @param {string} key
 */
export function kvPageRecord(kv: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<unknown>;
}, key: string): {
    /** @returns {Promise<PageRecord | undefined>} */
    load(): Promise<PageRecord | undefined>;
    /** @param {PageRecord} record */
    save(record: PageRecord): Promise<void>;
};
/**
 * Registers how the Worker renders one of its own pages (`(path, env)` to its HTML, or null when the path is not a page), set
 * once where the page handler is built (workers/app.ts) so the cron job can read the pages the way a visitor is served.
 *
 * @param {(path: string, env: any) => Promise<string | null>} renderer
 */
export function setPageRenderer(renderer: (path: string, env: any) => Promise<string | null>): void;
/**
 * `trackPageDates` for a rendered site: each path is rendered (`render`, which defaults to the `setPageRenderer` one, given
 * `env`) and read as the Markdown copy is made, its title, description and text, so the day a page's own text last changed is
 * what the sitemap says.
 *
 * @param {{ paths: string[], origin: string, load: () => Promise<PageRecord | undefined>, save: (record: PageRecord) => Promise<void>, env?: unknown, render?: (path: string) => Promise<string | null>, today?: string }} options
 * @returns {Promise<{ record: PageRecord, changed: boolean }>}
 */
export function trackRenderedPageDates({ paths, origin, load, save, env, render, today }: {
    paths: string[];
    origin: string;
    load: () => Promise<PageRecord | undefined>;
    save: (record: PageRecord) => Promise<void>;
    env?: unknown;
    render?: (path: string) => Promise<string | null>;
    today?: string;
}): Promise<{
    record: PageRecord;
    changed: boolean;
}>;
/**
 * each page's content hash and the day it last changed
 */
export type PageRecord = Record<string, {
    hash: string;
    lastmod: string;
}>;
