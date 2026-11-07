export type PageRecord = Record<string, { hash: string; lastmod: string }>;
/**
 * When each page of a static build last changed, for the sitemap's `lastmod`: a page whose text is the same as in the live build's
 * record keeps that record's date, and a changed or new one gets `today`.
 */
export function pageDates(
  pages: Array<[string, string]>,
  previous: PageRecord | undefined,
  today: string,
  options?: { ignore?: string[] },
): PageRecord;
/** The live build's page record: undefined when there is none yet, an error when it cannot be read. */
export function readPageRecord(source: string): Promise<PageRecord | undefined>;
/**
 * Tracks the pages no database row dates, by what they say: run it from a cron job. A page `read` cannot read keeps its entry.
 * `save` is called only when the record changed.
 */
export function trackPageDates(options: {
  paths: string[];
  read: (path: string) => Promise<string | null>;
  load: () => Promise<PageRecord | undefined>;
  save: (record: PageRecord) => Promise<void>;
  today?: string;
}): Promise<{ record: PageRecord; changed: boolean }>;
/** A page record in one KV key, as `trackPageDates` loads and saves it. */
export function kvPageRecord(
  kv: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<unknown>;
  },
  key: string,
): {
  load(): Promise<PageRecord | undefined>;
  save(record: PageRecord): Promise<void>;
};
