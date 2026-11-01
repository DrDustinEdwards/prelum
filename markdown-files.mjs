/**
 * A static site's Markdown copies and llms-full.txt, written at build time (Node), so its Worker needs no HTML parser: it
 * serves the files with `serveMarkdownCopies` from `./llms`. The `prelum-markdown` bin runs it.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { llmsFullDocument, markdownPage, markdownPath } from "./llms.mjs";
import { htmlToMarkdown, llmsHeaderOf, sitemapLocs } from "./markdown-copy.mjs";

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
    const page = { title: facts.title, description: facts.description, url: facts.canonical ?? `${base}${address}`, markdown: facts.markdown };
    await writeFile(join(dir, markdownPath(address).slice(1)), markdownPage(page));
    pages.set(address.replace(/\/$/, "") || "/", page);
  }
  const read = (/** @type {string} */ name) => readFile(join(dir, name), "utf8").catch(() => "");
  const order = sitemapLocs(await read("sitemap.xml")).map((loc) => new URL(loc, base).pathname.replace(/\/$/, "") || "/");
  const ordered = [...order.filter((path) => pages.has(path)), ...[...pages.keys()].filter((path) => !order.includes(path))];
  const header = llmsHeaderOf(await read("llms.txt"), base);
  const list = ordered.map((path) => /** @type {import("./llms.mjs").LlmsPage} */ (pages.get(path)));
  await writeFile(join(dir, "llms-full.txt"), llmsFullDocument({ ...header, pages: list }));
  return ordered;
}
