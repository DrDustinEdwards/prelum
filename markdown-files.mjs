/**
 * A static site's Markdown copies and llms-full.txt, written at build time (Node), so its Worker needs no HTML parser: it
 * serves the files with `serveMarkdownCopies` from `./llms`. The `prelum-markdown` bin runs it.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { sitemapLocs } from "@dustinedwards/site-runtime/html";
import { unescapeXml } from "./xml.mjs";
import { pageDates, readPageRecord } from "./lastmod.mjs";
import { llmsFullDocument, markdownPage, markdownPath } from "./llms.mjs";
import { htmlToMarkdown, llmsHeaderOf } from "./markdown-copy.mjs";

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
export async function writeMarkdownCopies({ dir, origin, skip = () => false }) {
  const base = origin.replace(/\/$/, "");
  /** @type {string[]} */
  const files = [];
  const walk = async (/** @type {string} */ at) => {
    for (const entry of await readdir(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith(".html") && entry.name !== "404.html") files.push(path);
    }
  };
  await walk(dir);
  /** @type {Map<string, import("./llms.mjs").LlmsPage>} */
  const pages = new Map();
  for (const file of files.sort()) {
    const rel = relative(dir, file).split(sep).join("/");
    const address = `/${rel.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")}`;
    if (skip(address)) continue;
    const facts = htmlToMarkdown(await readFile(file, "utf8"), { base: `${base}${address}` });
    if (facts.noindex) continue;
    const page = {
      title: facts.title,
      description: facts.description,
      url: facts.canonical ?? `${base}${address}`,
      markdown: facts.markdown,
    };
    await writeFile(join(dir, markdownPath(address).slice(1)), markdownPage(page));
    pages.set(address.replace(/\/$/, "") || "/", page);
  }
  const read = (/** @type {string} */ name) => readFile(join(dir, name), "utf8").catch(() => "");
  const order = sitemapLocs(await read("sitemap.xml")).map(
    (loc) => new URL(loc, base).pathname.replace(/\/$/, "") || "/",
  );
  const ordered = [
    ...order.filter((path) => pages.has(path)),
    ...[...pages.keys()].filter((path) => !order.includes(path)),
  ];
  const header = llmsHeaderOf(await read("llms.txt"), base);
  const list = ordered.map(
    (path) => /** @type {import("./llms.mjs").LlmsPage} */ (pages.get(path)),
  );
  await writeFile(join(dir, "llms-full.txt"), llmsFullDocument({ ...header, pages: list }));
  return ordered;
}

/**
 * A static site's sitemap `lastmod`, per page, written after `writeMarkdownCopies`: each URL in `dir`'s sitemap.xml gets the
 * day its Markdown copy (the page's text, so a new CSS or script hash changes nothing) last changed, from `pageDates` against the
 * live build's `build.json`, and `build.json` is written beside the sitemap for the next build to read. A URL with no copy (a
 * page left out, or noindex) keeps no `lastmod`, and any `lastmod` the sitemap had is replaced. Returns the record.
 *
 * @param {{ dir: string, origin: string, previous?: string, today?: string }} options `previous` is the live record's address
 *   (default `<origin>/build.json`); `today` is `YYYY-MM-DD` (default the UTC day)
 * @returns {Promise<import("./lastmod.mjs").PageRecord>}
 */
export async function writeSitemapLastmod({ dir, origin, previous, today }) {
  const base = origin.replace(/\/$/, "");
  const day = today ?? new Date().toISOString().slice(0, 10);
  const sitemap = await readFile(join(dir, "sitemap.xml"), "utf8");
  /** @type {Array<[string, string]>} */
  const pages = [];
  for (const loc of sitemapLocs(sitemap)) {
    const path = new URL(loc, base).pathname;
    const copy = await readFile(join(dir, markdownPath(path).slice(1)), "utf8").catch(() => null);
    if (copy !== null) pages.push([path, copy]);
  }
  const record = pageDates(pages, await readPageRecord(previous ?? `${base}/build.json`), day);
  const written = sitemap.replace(/<url>[\s\S]*?<\/url>/g, (block) => {
    const loc = /<loc>([^<]*)<\/loc>/.exec(block)?.[1];
    if (loc === undefined) return block;
    const entry = record[new URL(unescapeXml(loc), base).pathname];
    const bare = block.replace(/\s*<lastmod>[^<]*<\/lastmod>/, "");
    return entry
      ? bare.replace(/(<loc>[^<]*<\/loc>)(\s*)/, `$1$2<lastmod>${entry.lastmod}</lastmod>$2`)
      : bare;
  });
  await writeFile(join(dir, "sitemap.xml"), written);
  await writeFile(join(dir, "build.json"), `${JSON.stringify({ pages: record }, null, 2)}\n`);
  return record;
}
