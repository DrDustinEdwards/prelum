import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

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
export function pageDates(pages, previous, today, options = {}) {
  /** @type {PageRecord} */
  const record = {};
  for (const [path, html] of pages) {
    let text = html;
    for (const part of options.ignore ?? []) if (part) text = text.replaceAll(part, "");
    const hash = createHash("sha256").update(text).digest("hex");
    const before = previous?.[path];
    record[path] = { hash, lastmod: before && before.hash === hash ? before.lastmod : today };
  }
  return record;
}

/**
 * The live build's page record: `undefined` when there is none (a 404, a missing file, a first deploy), and an error when the
 * record cannot be read, since a build that carried on would date every page today.
 *
 * @param {string} source an https address or a file path
 * @returns {Promise<PageRecord | undefined>}
 */
export async function readPageRecord(source) {
  let text;
  if (source.startsWith("https://")) {
    const response = await fetch(source, { headers: { accept: "application/json" } });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`${source}: ${response.status}`);
    text = await response.text();
  } else {
    try {
      text = readFileSync(source, "utf8");
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return undefined;
      throw error;
    }
  }
  const pages = JSON.parse(text)?.pages;
  return pages && typeof pages === "object" ? pages : undefined;
}
