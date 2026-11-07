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
