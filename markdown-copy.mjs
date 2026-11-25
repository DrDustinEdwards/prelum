/**
 * A Markdown copy of every page, and llms-full.txt, for any site: the page's HTML turned into Markdown where the site has no
 * Markdown of its own. `markdownCopies` wraps a Worker's fetch handler, so one line gives every page on a site its `.md` URL
 * and its `Accept: text/markdown` answer (what Cloudflare's Markdown for Agents does on a paid zone), and gives the site an
 * llms-full.txt built from its sitemap. A site that serves its own copy of a page, or its own llms-full.txt, keeps it: the
 * wrapper only fills in what the site answers 404 or HTML for.
 *
 * Needs `htmlparser2`, `hastscript`, `hast-util-to-mdast`, `mdast-util-to-markdown` and `mdast-util-gfm`, optional peers.
 * The page is read with htmlparser2 (render-hast.mjs `fromHtml`), not parse5: the pages are the site's own well-formed HTML.
 * Only its `Parser` callbacks are used, the same in 10 and 12, so a site whose Worker already carries htmlparser2 10
 * (linkedom's) shares that one copy.
 */

import { sitemapLocs } from "@dustinedwards/site-runtime/html";

import {
  llmsFullDocument,
  markdownPage,
  markdownPath,
  markdownResponse,
  prefersMarkdown,
} from "./llms.mjs";
import { htmlToMarkdown } from "./markdown-html.mjs";
import { plainTextResponse } from "./robots.mjs";
export { htmlToMarkdown } from "./markdown-html.mjs";

/**
 * The title, summary and intro of an llms.txt, for the llms-full.txt that repeats them: the `#` line, the `>` lines, and the
 * paragraphs before the first `##` section. A missing file gives the origin's host as the title.
 *
 * @param {string} text
 * @param {string} origin
 */
export function llmsHeaderOf(text, origin) {
  const lines = text.split("\n");
  const title =
    lines
      .find((line) => line.startsWith("# "))
      ?.slice(2)
      .trim() ?? new URL(origin).hostname;
  const summary = lines
    .filter((line) => line.startsWith("> "))
    .map((line) => line.slice(2).trim())
    .join(" ");
  const firstSection = lines.findIndex((line) => line.startsWith("## "));
  const lastQuote = lines.findLastIndex((line) => line.startsWith("> "));
  const titleLine = lines.findIndex((line) => line.startsWith("# "));
  const intro = lines
    .slice(Math.max(lastQuote, titleLine) + 1, firstSection < 0 ? lines.length : firstSection)
    .join("\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return { title, summary, intro };
}

/**
 * @typedef {(request: Request, env?: any, ctx?: any) => Promise<Response> | Response} FetchHandler
 * A Worker's fetch handler; `env` and `ctx` (its ExecutionContext) are passed through untouched, so a handler that reads
 * `ctx.exports` or `ctx.passThroughOnException` keeps its own types.
 */

/**
 * @typedef {object} MarkdownCopiesOptions
 * @property {string} origin the site's production origin, for the canonical links and the llms-full.txt addresses
 * @property {number | false} [llmsFull] build /llms-full.txt from the sitemap when the site serves none, with at most this many
 *   pages (200 by default); false leaves /llms-full.txt to the site
 * @property {(path: string) => boolean} [skip] pages that get no Markdown copy, by path
 * @property {(path: string) => boolean} [llmsFullSkip] pages that get a copy but stay out of llms-full.txt, by path: a
 *   catalog of records, say, which an agent fetches one at a time
 * @property {boolean} [siteMarkdown] whether the site may answer a `.md` path itself (true by default, so it is asked first);
 *   false when it answers none, so the copy is made without that first request, which a site that counts its 404s would count
 */

/** A response's headers, carried to its Markdown copy without the ones that describe the HTML body. */
const BODY_HEADERS = [
  "content-type",
  "content-length",
  "content-encoding",
  "etag",
  "last-modified",
  "link",
  "vary",
  "set-cookie",
];

/**
 * The same request for another path, asking for HTML: the page a Markdown copy is made from.
 * @param {Request} request
 * @param {string} path
 */
function htmlRequest(request, path) {
  const url = new URL(request.url);
  url.pathname = path;
  url.search = "";
  const headers = new Headers(request.headers);
  headers.set("Accept", "text/html");
  return new Request(url, { method: "GET", headers, redirect: "manual" });
}

/** @param {Response} response */
const isHtml = (response) =>
  response.status === 200 && (response.headers.get("Content-Type") ?? "").startsWith("text/html");

/**
 * Wraps a Worker's fetch handler so every page has a Markdown copy:
 *
 * - `/path.md` (and `/index.md` for the home page): the site's own answer when it has one, else the page at `/path`
 *   turned into Markdown with `htmlToMarkdown` and written by `markdownPage`, with `Link: rel="canonical"` to the page.
 * - A page asked for with `Accept: text/markdown` preferred (`prefersMarkdown`): the same copy, with `Vary: Accept`; a site
 *   that answers Markdown itself keeps its answer.
 * - Every other HTML page: as the site answers it, plus `Vary: Accept` and a `Link: rel="alternate"; type="text/markdown"`
 *   naming its copy, so an agent can find it.
 * - `/llms-full.txt`, where the site answers 404: the site's llms.txt title, summary and intro, then every page in its
 *   sitemap (`<sitemapindex>` followed one level) as `markdownPage` writes it, pages marked noindex left out. It is kept in
 *   the Cache API for the plain-text cache lifetime.
 *
 * The copy keeps the page's headers (its cache policy, the security headers) apart from those describing the HTML. A
 * redirect is followed within the site, up to twice. Only GET and HEAD are touched.
 *
 * @template {FetchHandler} F
 * @param {F} fetch
 * @param {MarkdownCopiesOptions} options
 * @returns {F}
 */
export function markdownCopies(fetch, options) {
  const origin = options.origin.replace(/\/$/, "");
  const maxPages = options.llmsFull === false ? 0 : (options.llmsFull ?? 200);
  const skip = options.skip ?? (() => false);
  const leaveOut = options.llmsFullSkip ?? (() => false);
  const siteMarkdown = options.siteMarkdown ?? true;

  /**
   * The page at `path` as the site renders it, following its redirects.
   * @param {Request} request @param {string} path @param {any} env @param {any} ctx
   */
  async function page(request, path, env, ctx) {
    let current = path;
    for (let hops = 0; hops < 3; hops++) {
      const response = await fetch(htmlRequest(request, current), env, ctx);
      const location =
        response.status >= 300 && response.status < 400 ? response.headers.get("Location") : null;
      if (!location) return response;
      const next = new URL(location, new URL(current, request.url));
      if (next.origin !== new URL(request.url).origin) return response;
      void response.body?.cancel();
      current = next.pathname;
    }
    return fetch(htmlRequest(request, current), env, ctx);
  }

  /**
   * The Markdown copy of an HTML response, or null when it is not a page.
   * @param {Request} request @param {Response} response @param {string} path @param {boolean} vary
   */
  async function copy(request, response, path, vary) {
    if (!isHtml(response)) return null;
    const facts = htmlToMarkdown(await response.text(), { base: `${origin}${path}` });
    const headers = new Headers(response.headers);
    for (const name of BODY_HEADERS) headers.delete(name);
    if (facts.noindex) headers.set("X-Robots-Tag", "noindex");
    const canonical = facts.canonical ?? `${origin}${path}`;
    const markdown = markdownPage({ ...facts, url: canonical });
    const out = markdownResponse(markdown, {
      canonical,
      vary,
      headers: Object.fromEntries(headers),
    });
    return request.method === "HEAD" ? new Response(null, out) : out;
  }

  /** @param {Request} request @param {any} env @param {any} ctx */
  async function llmsFull(request, env, ctx) {
    const cache = /** @type {any} */ (globalThis).caches?.default;
    const preview = new URL(request.url).origin !== origin;
    const key = new Request(new URL("/llms-full.txt", request.url));
    const kept = cache && !preview ? await cache.match(key) : undefined;
    if (kept) return kept;

    const anonymous = new Request(new URL("/", request.url)); // the shared file never carries the first visitor's Cookie or language
    const guide = await fetch(htmlRequest(anonymous, "/llms.txt"), env, ctx);
    const { title, summary, intro } = llmsHeaderOf(guide.ok ? await guide.text() : "", origin);

    const read = async (/** @type {string} */ path) => {
      const response = await fetch(htmlRequest(anonymous, path), env, ctx);
      return response.ok ? await response.text() : "";
    };
    const index = await read("/sitemap.xml");
    const sitemaps = /<sitemapindex\b/.test(index)
      ? await Promise.all(sitemapLocs(index).map((loc) => read(new URL(loc).pathname)))
      : [index];
    const paths = [
      ...new Set(sitemaps.flatMap(sitemapLocs).map((loc) => new URL(loc, origin).pathname)),
    ]
      .filter((path) => !skip(path) && !leaveOut(path))
      .slice(0, maxPages);

    /** @type {(import("./llms.mjs").LlmsPage | null)[]} */
    const pages = Array.from({ length: paths.length }, () => null);
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const at = next++;
        const path = paths[at] ?? "/";
        const response = await page(anonymous, path, env, ctx);
        if (!isHtml(response)) {
          void response.body?.cancel();
          continue;
        }
        const facts = htmlToMarkdown(await response.text(), { base: `${origin}${path}` });
        if (facts.noindex) continue;
        pages[at] = { ...facts, url: facts.canonical ?? `${origin}${path}` };
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    const body = llmsFullDocument({
      title,
      summary,
      intro,
      pages: pages.filter((entry) => entry !== null),
    });
    const response = plainTextResponse(body, {
      origin,
      request,
      noindex: true,
      headers: { Link: `<${origin}/>; rel="canonical"` },
    });
    if (cache && !preview) {
      const stored = cache.put(key, response.clone());
      if (ctx?.waitUntil) ctx.waitUntil(stored);
      else await stored;
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  /** @type {(request: Request, env?: any, ctx?: any) => Promise<Response>} */
  const wrapped = async (request, env, ctx) => {
    if (request.method !== "GET" && request.method !== "HEAD") return fetch(request, env, ctx);
    const path = new URL(request.url).pathname;

    if (path === "/llms-full.txt" && maxPages > 0) {
      const own = await fetch(request, env, ctx);
      if (own.status !== 404) return own;
      void own.body?.cancel();
      return llmsFull(request, env, ctx);
    }

    if (path.endsWith(".md")) {
      const pagePath = path === "/index.md" ? "/" : path.slice(0, -3);
      if (!siteMarkdown) {
        const made = skip(pagePath)
          ? null
          : await copy(request, await page(request, pagePath, env, ctx), pagePath, false);
        return made ?? fetch(request, env, ctx);
      }
      const own = await fetch(request, env, ctx);
      if (own.status !== 404) return own;
      if (skip(pagePath)) return own;
      const made = await copy(request, await page(request, pagePath, env, ctx), pagePath, false);
      if (!made) return own;
      void own.body?.cancel();
      return made;
    }

    const response = await fetch(request, env, ctx);
    if (!isHtml(response) || skip(path)) return response;
    if (prefersMarkdown(request)) {
      // A HEAD has no body to read, so the copy is made from the page's GET.
      if (request.method === "HEAD") void response.body?.cancel();
      const html =
        request.method === "HEAD" ? await fetch(htmlRequest(request, path), env, ctx) : response;
      const made = await copy(request, html, path, true);
      if (made) return made;
    }
    const out = new Response(response.body, response);
    out.headers.append("Vary", "Accept");
    out.headers.append(
      "Link",
      `<${origin}${markdownPath(path)}>; rel="alternate"; type="text/markdown"`,
    );
    return out;
  };
  return /** @type {F} */ (/** @type {unknown} */ (wrapped));
}
