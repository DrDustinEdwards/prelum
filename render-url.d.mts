/**
 * Schemeless means relative and is allowed: footnotes and heading autolinks are fragments. The decoded form must pass too, so a
 * percent-encoded scheme cannot be smuggled past.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedUrl(value: string): boolean;
/**
 * A chart's "Download CSV" link (Enarratio, `a[download]`): a percent-encoded CSV, the one data: URL a page may carry. Only on a
 * link with `download`, which markdown cannot write, so an author's link never takes this path. Browsers refuse to navigate to a
 * data: URL, and CSV is not run, so the worst it can do is save a file.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isCsvDownload(value: string): boolean;
