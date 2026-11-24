/**
 * A static site's Markdown copies, written at build time beside its pages: for each `.html` file in `dir` (the 404 page and
 * noindex pages left out), the page's copy at `markdownPath` of its address (`index.html` is `/index.md`, `about.html` and
 * `about/index.html` are `/about.md`), and `llms-full.txt` from `dir`'s own llms.txt header and every copy, in the
 * sitemap's order where `dir` has a sitemap.xml. A site whose Worker serves the files with `serveMarkdownCopies` (from
 * `./llms`, no HTML parser in the Worker) then answers `/path.md` and `Accept: text/markdown` as a rendered site does with
 * `markdownCopies`. Returns the addresses written, in order.
 *
 * @param {{ dir: string, origin: string, skip?: (path: string) => boolean }} options
 * @returns {Promise<string[]>}
 */
export function writeMarkdownCopies({ dir, origin, skip }: {
    dir: string;
    origin: string;
    skip?: (path: string) => boolean;
}): Promise<string[]>;
/**
 * A static site's sitemap `lastmod`, per page, written after `writeMarkdownCopies`: each URL in `dir`'s sitemap.xml gets the
 * day its Markdown copy (the page's text, so a new CSS or script hash changes nothing) last changed, from `pageDates` against the
 * live build's `build.json`, and `build.json` is written beside the sitemap for the next build to read. A URL with no copy (a
 * page left out, or noindex) keeps no `lastmod`, and any `lastmod` the sitemap had is replaced. Returns the record.
 *
 * @param {{ dir: string, origin: string, previous?: string, today?: string, ignore?: string[] }} options `previous` is the live record's address
 *   (default `<origin>/build.json`); `today` is `YYYY-MM-DD` (default the UTC day); `ignore` is text
 *   left out before hashing, such as the release number a page prints
 * @returns {Promise<import("./lastmod.mjs").PageRecord>}
 */
export function writeSitemapLastmod({ dir, origin, previous, today, ignore }: {
    dir: string;
    origin: string;
    previous?: string;
    today?: string;
    ignore?: string[];
}): Promise<import("./lastmod.mjs").PageRecord>;
