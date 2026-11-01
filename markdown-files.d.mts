/**
 * A static site's Markdown copies, written at build time beside its pages: for each `.html` file in `dir` (the 404 page and
 * noindex pages left out), the page's copy at `markdownPath` of its address (`index.html` is `/index.md`, `about.html` and
 * `about/index.html` are `/about.md`), and `llms-full.txt` from `dir`'s own llms.txt header and every copy, in the sitemap's
 * order where `dir` has a sitemap.xml. The Worker serves them with `serveMarkdownCopies` from `./llms`. Returns the addresses
 * written, in order.
 */
export function writeMarkdownCopies(options: {
    dir: string;
    origin: string;
    skip?: (path: string) => boolean;
}): Promise<string[]>;
