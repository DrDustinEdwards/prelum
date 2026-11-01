/**
 * A Markdown copy of every page, and llms-full.txt, for any site: the page's HTML turned into Markdown where the site has no
 * Markdown of its own. `markdownCopies` wraps a Worker's fetch handler, so one line gives every page on a site its `.md` URL
 * and its `Accept: text/markdown` answer (what Cloudflare's Markdown for Agents does on a paid zone), and gives the site an
 * llms-full.txt built from its sitemap. A site that serves its own copy of a page, or its own llms-full.txt, keeps it: the
 * wrapper only fills in what the site answers 404 or HTML for.
 *
 * Needs `hast-util-from-html`, `hast-util-to-mdast`, `mdast-util-to-markdown` and `mdast-util-gfm`, optional peers.
 */

import { fromHtml } from "hast-util-from-html";
import { toMdast } from "hast-util-to-mdast";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

import { llmsFullDocument, markdownPage, markdownPath, markdownResponse, prefersMarkdown } from "./llms.mjs";
import { plainTextResponse } from "./robots.mjs";

/** Elements that carry no reading text: scripts, styles, controls, the site's own navigation, players and drawings. */
const DROPPED = new Set([
  "script",
  "style",
  "noscript",
  "template",
  "link",
  "meta",
  "svg",
  "canvas",
  "nav",
  "form",
  "button",
  "input",
  "select",
  "textarea",
  "dialog",
  "iframe",
  "video",
  "audio",
  "object",
  "embed",
]);

/** @typedef {import("hast").Root | import("hast").Element} Parent */

/** @param {import("hast").Element} node @param {string} name */
const prop = (node, name) => {
  const value = node.properties?.[name];
  return Array.isArray(value) ? value.join(" ") : value === undefined || value === null ? undefined : String(value);
};

/** @param {import("hast").Nodes} node @returns {string} */
const text = (node) =>
  node.type === "text" ? node.value : "children" in node ? node.children.map((child) => text(/** @type {import("hast").Nodes} */ (child))).join("") : "";

/**
 * The first element that passes `test`, depth first.
 * @param {Parent} node
 * @param {(element: import("hast").Element) => boolean} test
 * @returns {import("hast").Element | undefined}
 */
function find(node, test) {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    if (test(child)) return child;
    const found = find(child, test);
    if (found) return found;
  }
  return undefined;
}

/**
 * Drops what a reader would not read (DROPPED, anything hidden), in place.
 * @param {Parent} node
 */
function prune(node) {
  node.children = node.children.filter((child) => {
    if (child.type === "comment") return false;
    if (child.type !== "element") return true;
    if (DROPPED.has(child.tagName)) return false;
    if (child.properties?.hidden !== undefined && child.properties.hidden !== false) return false;
    if (prop(child, "ariaHidden") === "true" || child.properties?.inert) return false;
    prune(child);
    return true;
  });
}

/**
 * Link and image addresses made absolute, and the headings shifted so the body's start at `##` (`markdownPage` writes the
 * title as the one `#`). A `data:` link (a chart's CSV download) is no address an agent can follow, so it keeps only its text.
 * @param {import("mdast").Nodes} node
 * @param {string} base
 */
function settle(node, base) {
  if ((node.type === "link" || node.type === "image" || node.type === "definition") && node.url) {
    try {
      node.url = new URL(node.url, base).href;
    } catch {
      // An address URL cannot read is kept as written.
    }
  }
  if (node.type === "heading" && node.depth === 1) node.depth = 2;
  if (!("children" in node)) return;
  /** @type {any[]} */
  const children = node.children;
  node.children = /** @type {any} */ (children.flatMap((child) => (child.type === "link" && child.url.startsWith("data:") ? child.children : [child])));
  for (const child of node.children) settle(child, base);
}

/**
 * @typedef {object} MarkdownCopy
 * @property {string} title the page's name: `og:title`, else `<title>`, else its first heading
 * @property {string} description the meta description, or ""
 * @property {string | undefined} canonical the canonical link, absolute
 * @property {boolean} noindex the page asks search engines to leave it out
 * @property {string} markdown the body of the page's `<main>` (or `<body>`) as Markdown, its headings from `##`
 */

/**
 * A page's HTML as Markdown: the facts from its head and the text of its `<main>`, or its `<body>` when it has none. The
 * main heading is dropped (it is the title), as are scripts, styles, controls, navigation, drawings and anything hidden;
 * a chart's written description and data table stay, since they are its text. Links are made absolute against the
 * canonical URL, or `base`.
 *
 * @param {string} html
 * @param {{ base?: string }} [options]
 * @returns {MarkdownCopy}
 */
export function htmlToMarkdown(html, { base } = {}) {
  const tree = fromHtml(html);
  const head = find(tree, (element) => element.tagName === "head");
  const meta = (/** @type {string} */ key, /** @type {string} */ value) =>
    head ? find(head, (element) => element.tagName === "meta" && prop(element, key)?.toLowerCase() === value) : undefined;
  const titleElement = head && find(head, (element) => element.tagName === "title");
  const canonicalElement = head && find(head, (element) => element.tagName === "link" && (prop(element, "rel") ?? "").split(/\s+/).includes("canonical"));
  const href = canonicalElement && prop(canonicalElement, "href");
  const canonical = href && base ? new URL(href, base).href : href;
  const robots = prop(meta("name", "robots") ?? { type: "element", tagName: "meta", properties: {}, children: [] }, "content") ?? "";

  const main = find(tree, (element) => element.tagName === "main") ?? find(tree, (element) => element.tagName === "body") ?? tree;
  prune(main);
  const h1 = find(main, (element) => element.tagName === "h1");
  const ogTitle = meta("property", "og:title");
  const title = (ogTitle && prop(ogTitle, "content")) || (titleElement && text(titleElement).trim()) || (h1 && text(h1).trim()) || "";
  if (h1) {
    /** @param {Parent} node @returns {boolean} */
    const remove = (node) => {
      const at = node.children.indexOf(h1);
      if (at >= 0) {
        node.children.splice(at, 1);
        return true;
      }
      return node.children.some((child) => child.type === "element" && remove(child));
    };
    remove(main);
  }
  const description = meta("name", "description");
  const mdast = toMdast(main);
  settle(mdast, canonical ?? base ?? "https://invalid.example/");
  const markdown = toMarkdown(mdast, { extensions: [gfmToMarkdown()], bullet: "-", emphasis: "_", rule: "-" })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return {
    title: title.replace(/\s+/g, " ").trim(),
    description: ((description && prop(description, "content")) ?? "").replace(/\s+/g, " ").trim(),
    canonical,
    noindex: /\bnoindex\b/i.test(robots),
    markdown,
  };
}

/**
 * @typedef {(request: Request, env?: any, ctx?: { waitUntil(promise: Promise<unknown>): void }) => Promise<Response> | Response} FetchHandler
 */

/**
 * @typedef {object} MarkdownCopiesOptions
 * @property {string} origin the site's production origin, for the canonical links and the llms-full.txt addresses
 * @property {number | false} [llmsFull] build /llms-full.txt from the sitemap when the site serves none, with at most this many
 *   pages (200 by default); false leaves /llms-full.txt to the site
 * @property {(path: string) => boolean} [skip] pages that get no Markdown copy, by path
 */

/** A response's headers, carried to its Markdown copy without the ones that describe the HTML body. */
const BODY_HEADERS = ["content-type", "content-length", "content-encoding", "etag", "last-modified", "link", "vary"];

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
const isHtml = (response) => response.status === 200 && (response.headers.get("Content-Type") ?? "").startsWith("text/html");

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

  /**
   * The page at `path` as the site renders it, following its redirects.
   * @param {Request} request @param {string} path @param {any} env @param {any} ctx
   */
  async function page(request, path, env, ctx) {
    let current = path;
    for (let hops = 0; hops < 3; hops++) {
      const response = await fetch(htmlRequest(request, current), env, ctx);
      const location = response.status >= 300 && response.status < 400 ? response.headers.get("Location") : null;
      if (!location) return response;
      const next = new URL(location, new URL(current, request.url));
      if (next.origin !== new URL(request.url).origin) return response;
      response.body?.cancel();
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
    const markdown = markdownPage({ title: facts.title, description: facts.description, url: canonical, markdown: facts.markdown });
    const out = markdownResponse(markdown, { canonical, vary, headers: Object.fromEntries(headers) });
    return request.method === "HEAD" ? new Response(null, out) : out;
  }

  /** @param {Request} request @param {any} env @param {any} ctx */
  async function llmsFull(request, env, ctx) {
    const cache = /** @type {any} */ (globalThis).caches?.default;
    const preview = new URL(request.url).origin !== origin;
    const key = new Request(new URL("/llms-full.txt", request.url));
    const kept = cache && !preview ? await cache.match(key) : undefined;
    if (kept) return kept;

    const guide = await fetch(htmlRequest(request, "/llms.txt"), env, ctx);
    const lines = guide.ok ? (await guide.text()).split("\n") : [];
    const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? new URL(origin).hostname;
    const summary = lines
      .filter((line) => line.startsWith("> "))
      .map((line) => line.slice(2).trim())
      .join(" ");
    const firstSection = lines.findIndex((line) => line.startsWith("## "));
    const lastQuote = lines.findLastIndex((line) => line.startsWith("> "));
    const intro = lines
      .slice(lastQuote + 1, firstSection < 0 ? lines.length : firstSection)
      .join("\n")
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    /** @param {string} path @returns {Promise<string[]>} */
    const locs = async (path) => {
      const response = await fetch(htmlRequest(request, path), env, ctx);
      if (!response.ok) return [];
      const xml = await response.text();
      const found = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1] ?? "");
      return /<sitemapindex\b/.test(xml) ? (await Promise.all(found.map((loc) => locs(new URL(loc).pathname)))).flat() : found;
    };
    const paths = [...new Set((await locs("/sitemap.xml")).map((loc) => new URL(loc, origin).pathname))]
      .filter((path) => !skip(path))
      .slice(0, maxPages);

    /** @type {(import("./llms.mjs").LlmsPage | null)[]} */
    const pages = Array.from({ length: paths.length }, () => null);
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const at = next++;
        const path = paths[at] ?? "/";
        const response = await page(request, path, env, ctx);
        if (!isHtml(response)) {
          response.body?.cancel();
          continue;
        }
        const facts = htmlToMarkdown(await response.text(), { base: `${origin}${path}` });
        if (facts.noindex) continue;
        pages[at] = { title: facts.title, description: facts.description, url: facts.canonical ?? `${origin}${path}`, markdown: facts.markdown };
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    const body = llmsFullDocument({ title, summary, intro, pages: pages.filter((entry) => entry !== null) });
    const response = plainTextResponse(body, { origin, request, noindex: true, headers: { Link: `<${origin}/>; rel="canonical"` } });
    if (cache && !preview) {
      const stored = cache.put(key, response.clone());
      if (ctx?.waitUntil) ctx.waitUntil(stored);
      else await stored;
    }
    return request.method === "HEAD" ? new Response(null, response) : response;
  }

  /** @type {FetchHandler} */
  const wrapped = async (request, env, ctx) => {
    if (request.method !== "GET" && request.method !== "HEAD") return fetch(request, env, ctx);
    const path = new URL(request.url).pathname;

    if (path === "/llms-full.txt" && maxPages > 0) {
      const own = await fetch(request, env, ctx);
      if (own.status !== 404) return own;
      own.body?.cancel();
      return llmsFull(request, env, ctx);
    }

    if (path.endsWith(".md")) {
      const own = await fetch(request, env, ctx);
      if (own.status !== 404) return own;
      const pagePath = path === "/index.md" ? "/" : path.slice(0, -3);
      if (skip(pagePath)) return own;
      const made = await copy(request, await page(request, pagePath, env, ctx), pagePath, false);
      if (!made) return own;
      own.body?.cancel();
      return made;
    }

    const response = await fetch(request, env, ctx);
    if (!isHtml(response) || skip(path)) return response;
    if (prefersMarkdown(request)) {
      // A HEAD has no body to read, so the copy is made from the page's GET.
      if (request.method === "HEAD") response.body?.cancel();
      const html = request.method === "HEAD" ? await fetch(htmlRequest(request, path), env, ctx) : response;
      const made = await copy(request, html, path, true);
      if (made) return made;
    }
    const out = new Response(response.body, response);
    out.headers.append("Vary", "Accept");
    out.headers.append("Link", `<${origin}${markdownPath(path)}>; rel="alternate"; type="text/markdown"`);
    return out;
  };
  return /** @type {F} */ (/** @type {unknown} */ (wrapped));
}
