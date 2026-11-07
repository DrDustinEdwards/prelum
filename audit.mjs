import { SERP_DESCRIPTION, SERP_TITLE, serpWidth } from "./head.mjs";

/** How many redirects `crawlSite` follows from one URL, so a chain is seen hop by hop and a loop ends. */
const MAX_HOPS = 5;

/**
 * @typedef {object} AuditPage
 * @property {string} url absolute
 * @property {number} status the HTTP status the crawl got; 0 when the fetch itself failed
 * @property {Record<string, string> | Headers} [headers] the response headers (`X-Robots-Tag` is read from them)
 * @property {string} [html] the body, for a 200 HTML page; a page without one gets no head checks
 * @property {string} [location] where a 3xx pointed
 * @property {string[]} [redirectedFrom] the URLs that redirected to this one, first to last
 * @property {boolean} [inSitemap]
 * @property {string} [error] why the fetch failed, for status 0
 */

/**
 * @typedef {object} AuditFinding
 * @property {string} url
 * @property {string} check
 * @property {"error" | "warning" | "unmeasured"} severity error: search engines get it wrong; warning: worse results;
 *   unmeasured: the page could not be read, so nothing about it was measured (never a pass or a failure)
 * @property {string} detail
 */

/**
 * @typedef {object} AuditReport
 * @property {AuditFinding[]} findings
 * @property {number} pages how many pages were audited
 * @property {Record<string, number>} summary findings per check
 */

/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * `crawlSite`, Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags`
 * writes and the links in the page, so it needs no HTML parser. Pure: it fetches nothing.
 *
 * @param {AuditPage[]} pages
 * @param {{ origin: string, sitemap?: string[], robots?: string | null, lastmods?: Record<string, string | null> }} site `origin` is the production origin every canonical
 *   must be on; `sitemap` the URLs the sitemap lists (a page's own `inSitemap` counts too), and an empty list is itself a
 *   finding; `robots` the text of `/robots.txt` (`crawlSite` returns it, null when it did not load), left out to skip the
 *   robots checks; `lastmods` the sitemap's `lastmod` per URL (null for none), which `crawlSite` returns, left out to skip the
 *   lastmod checks
 * @returns {AuditReport}
 */
export function auditPages(pages, { origin, sitemap, robots: robotsText, lastmods }) {
  /** @type {AuditFinding[]} */
  const findings = [];
  const add = (
    /** @type {string} */ url,
    /** @type {string} */ check,
    /** @type {"error" | "warning" | "unmeasured"} */ severity,
    /** @type {string} */ detail,
  ) => findings.push({ url, check, severity, detail });
  const byUrl = new Map(pages.map((page) => [normalize(page.url), page]));
  const listed = new Set((sitemap ?? []).map(normalize));
  const inSitemap = (/** @type {AuditPage} */ page) =>
    Boolean(page.inSitemap) || listed.has(normalize(page.url));
  const redirectTargets = new Set(
    pages
      .filter(isRedirect)
      .map((page) => resolve(page.location, page.url))
      .filter(Boolean)
      .map((url) => normalize(/** @type {string} */ (url))),
  );
  /** @type {Map<string, string[]>} */
  const titles = new Map();
  /** @type {Map<string, string[]>} */
  const descriptions = new Map();

  if (sitemap && sitemap.length === 0)
    add(origin, "sitemap-empty", "error", "the sitemap lists no pages, or did not load");

  if (lastmods) {
    const urls = Object.keys(lastmods);
    const dated = urls.filter((url) => lastmods[url]);
    // Bing calls an accurate lastmod a top signal for what to recrawl, and Google uses it only where it has been
    // consistently accurate (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): a page
    // without one cannot say it changed, and one date on every page says the sitemap was built, not that the pages changed.
    if (urls.length > 0 && dated.length < urls.length)
      add(
        `${origin}/sitemap.xml`,
        "sitemap-lastmod-missing",
        "warning",
        `${urls.length - dated.length} of ${urls.length} sitemap URLs have no lastmod, e.g. ${urls.find((url) => !lastmods[url])}`,
      );
    if (dated.length >= 10 && new Set(dated.map((url) => lastmods[url])).size === 1)
      add(
        `${origin}/sitemap.xml`,
        "sitemap-lastmod-uniform",
        "warning",
        `all ${dated.length} dated URLs share the lastmod ${lastmods[dated[0]]}, which reads as the build date`,
      );
  }

  /** @type {Group | null} */
  let googlebot = null;
  if (robotsText === null)
    add(`${origin}/robots.txt`, "robots-missing", "warning", "robots.txt did not load as text");
  else if (robotsText !== undefined) {
    googlebot = robotsGroup(robotsText, "googlebot");
    if (!robotsAllows(googlebot, "/"))
      add(
        `${origin}/robots.txt`,
        "robots-blocks-all",
        "error",
        "robots.txt disallows the home page to Googlebot, so no page is crawled",
      );
    if (!/^\s*sitemap\s*:/im.test(robotsText))
      add(
        `${origin}/robots.txt`,
        "robots-no-sitemap",
        "warning",
        "robots.txt has no Sitemap line, so a crawler finds the sitemap only if it is told",
      );
    for (const url of listed) {
      const { pathname, search } = new URL(url);
      if (!robotsAllows(googlebot, pathname + search))
        add(url, "sitemap-blocked", "error", "the sitemap lists a URL robots.txt disallows");
    }
  }

  for (const page of pages) {
    const { url } = page;
    const from = page.redirectedFrom ?? [];
    if (from.length > 1 && !byUrl.has(normalize(from[0])))
      add(from[0], "redirect-chain", "warning", [...from, url].join(" -> "));
    if (isRedirect(page)) {
      if (!redirectTargets.has(normalize(url))) {
        const hops = chainFrom(page, byUrl);
        if (hops.length > 2) add(url, "redirect-chain", "warning", hops.join(" -> "));
      }
      if (inSitemap(page))
        add(url, "sitemap-redirect", "error", "the sitemap lists a URL that redirects");
      continue;
    }
    if (page.status === 0) {
      add(
        url,
        "fetch-failed",
        "unmeasured",
        `no answer (${page.error ?? "nothing came back"}), so the page was not audited`,
      );
      continue;
    }
    if (page.status !== 200) {
      if (inSitemap(page))
        add(url, "sitemap-broken", "error", `the sitemap lists a URL that answers ${page.status}`);
      continue;
    }
    if (page.html === undefined) continue;
    const { html } = page;
    const head = headOf(html);

    if (!/<html\b[^>]*\slang\s*=\s*["']?[a-z]/i.test(html))
      add(
        url,
        "html-lang-missing",
        "warning",
        "no lang on <html>, so a reader cannot pick the language",
      );
    if (!meta(head, "name", "viewport"))
      add(
        url,
        "viewport-missing",
        "warning",
        "no viewport meta, so Google's mobile-first crawl sees a desktop-width page",
      );
    if (!/<h1\b/i.test(html))
      add(url, "h1-missing", "warning", "no <h1>, so the page has no top heading");

    const title = textOf(head, "title");
    if (!title) add(url, "title-missing", "error", "no <title>");
    else {
      const width = Math.round(serpWidth(title, SERP_TITLE.font));
      if (width > SERP_TITLE.px)
        add(
          url,
          "title-long",
          "warning",
          `${width} px wide in Google's ${SERP_TITLE.font} px Arial (${Array.from(title).length} characters); a desktop result clips the title past ${SERP_TITLE.px} px`,
        );
      push(titles, title, url);
    }

    const description = meta(head, "name", "description");
    if (!description) add(url, "description-missing", "error", "no meta description");
    else {
      const width = Math.round(serpWidth(description, SERP_DESCRIPTION.font));
      if (width > SERP_DESCRIPTION.px) {
        add(
          url,
          "description-long",
          "warning",
          `${width} px wide in Google's ${SERP_DESCRIPTION.font} px Arial (${Array.from(description).length} characters); a desktop result clips the snippet past ${SERP_DESCRIPTION.px} px`,
        );
      }
      push(descriptions, description, url);
    }

    const canonicals = tags(head, "link").filter(
      (attrs) => attrs.rel?.toLowerCase() === "canonical",
    );
    const href = canonicals[0]?.href;
    const canonical = href ? resolve(href, url) : null;
    if (new Set(canonicals.map((attrs) => resolve(attrs.href, url))).size > 1)
      add(
        url,
        "canonical-multiple",
        "error",
        "more than one canonical link, and they differ, so Google ignores them all",
      );
    const ogUrl = meta(head, "property", "og:url");
    if (ogUrl && canonical && normalize(resolve(ogUrl, url) ?? ogUrl) !== normalize(canonical))
      add(
        url,
        "og-url-mismatch",
        "warning",
        `og:url is ${ogUrl}, but the canonical is ${canonical}`,
      );
    if (!canonical) add(url, "canonical-missing", "error", "no canonical link");
    else if (new URL(canonical).origin !== origin)
      add(url, "canonical-off-site", "error", `the canonical is ${canonical}, not on ${origin}`);
    else if (inSitemap(page) && normalize(canonical) !== normalize(url)) {
      add(
        url,
        "canonical-elsewhere",
        "error",
        `the sitemap lists this page, but its canonical is ${canonical}`,
      );
    }

    const robots = `${meta(head, "name", "robots") ?? ""} ${header(page.headers, "x-robots-tag")}`;
    if (inSitemap(page) && /noindex/i.test(robots))
      add(url, "sitemap-noindex", "error", "the sitemap lists a noindex page");
    if (!meta(head, "property", "og:title"))
      add(
        url,
        "og-title-missing",
        "warning",
        "no og:title, so a shared link's card falls back to a guess",
      );
    const card = meta(head, "property", "og:image");
    if (!card) add(url, "card-missing", "warning", "no og:image, so a shared link has no card");
    else {
      // What `headTags` writes from an image object; a bare image URL writes none of them.
      const missing = ["og:image:type", "og:image:width", "og:image:height", "og:image:alt"].filter(
        (property) => !meta(head, "property", property),
      );
      if (!card.startsWith("https://")) missing.unshift("an absolute https og:image");
      if (missing.length > 0)
        add(
          url,
          "card-incomplete",
          "warning",
          `no ${missing.join(", ")}, so the card is drawn late or unnamed`,
        );
    }

    for (const script of jsonLdBlocks(html)) {
      let data;
      try {
        data = JSON.parse(script);
      } catch {
        add(url, "jsonld-invalid", "error", "a JSON-LD block does not parse");
        continue;
      }
      for (const problem of jsonLdProblems(data)) add(url, "jsonld-incomplete", "warning", problem);
    }
    const images = tags(html, "img");
    for (const img of images) {
      const src = img.src ?? "an image";
      // Without width and height the browser cannot hold the space before the file arrives, and the layout jumps
      // (https://web.dev/articles/optimize-cls#images-without-dimensions). A data: URI is inline and has no wait.
      if (img.src && !img.src.startsWith("data:") && (!img.width || !img.height))
        add(url, "image-size-missing", "warning", `${src} has no width and height attributes`);
      // Google asks for descriptive file names (https://developers.google.com/search/docs/appearance/google-images).
      const file = (img.src ?? "").split(/[?#]/)[0].split("/").pop() ?? "";
      if (
        /^(img|dsc|dscn|dscf|pxl|image|photo|screenshot|untitled|download)[-_ ]?\d*\.[a-z0-9]+$/i.test(
          file,
        ) ||
        /^\d+\.[a-z0-9]+$/.test(file)
      )
        add(
          url,
          "image-filename-generic",
          "warning",
          `${src} is named ${file}, which says nothing about the picture`,
        );
      // alt="" is a decorative image, and right; a file name for alt is read aloud as one.
      if (
        img.alt !== undefined &&
        /^(image|photo|picture|img|graphic|logo|screenshot|thumbnail|banner)s?$/i.test(
          img.alt.trim(),
        )
      )
        add(
          url,
          "image-alt-generic",
          "warning",
          `the alt on ${src} is "${img.alt}", which does not say what the picture shows`,
        );
      else if (img.alt === undefined)
        add(url, "image-alt-missing", "warning", `no alt on ${img.src ?? "an image"}`);
      else if (isFileName(img.alt, img.src))
        add(
          url,
          "image-alt-filename",
          "warning",
          `the alt on ${img.src ?? "an image"} is a file name, "${img.alt}"`,
        );
    }
    // The first picture may be the page's largest, so it loads at once; with several below it, none lazy is wasted bytes.
    if (images.length >= 4 && !images.some((img) => img.loading === "lazy"))
      add(
        url,
        "image-lazy-missing",
        "warning",
        `${images.length} images and none has loading="lazy"`,
      );
    for (const target of new Set(internalLinks(html, url, origin).map(normalize))) {
      const linked = byUrl.get(target);
      if (!linked) continue;
      if (linked.status >= 400)
        add(url, "link-broken", "error", `links to ${linked.url}, which answers ${linked.status}`);
      else if (isRedirect(linked))
        add(
          url,
          "link-redirect",
          "error",
          `links to ${linked.url}, which redirects to ${linked.location ?? "somewhere"}`,
        );
    }
  }

  for (const [title, urls] of titles)
    if (urls.length > 1)
      for (const url of urls)
        add(url, "title-duplicate", "warning", `"${title}" is on ${urls.length} pages`);
  for (const [, urls] of descriptions)
    if (urls.length > 1)
      for (const url of urls)
        add(
          url,
          "description-duplicate",
          "warning",
          `the same description is on ${urls.length} pages`,
        );

  /** @type {Record<string, number>} */
  const summary = {};
  for (const { check } of findings) summary[check] = (summary[check] ?? 0) + 1;
  return { findings, pages: pages.length, summary };
}

/**
 * @typedef {object} CrawlInput
 * @property {string} origin the production origin; only its URLs are fetched
 * @property {typeof fetch} fetch every request goes through it, so a scheduled job can pass its own (and a test a fake)
 * @property {number} [maxPages] the most pages fetched in all, redirect hops and link checks included (200)
 * @property {string} [sitemapPath] where the sitemap is (`/sitemap.xml`); a sitemap index is followed one level
 */

/**
 * Fetch a site the way an audit crawler does, for `auditPages`: every sitemap URL with `redirect: "manual"`, following up to
 * five redirects itself so each hop is a page and a chain shows; then, status only (HEAD, or GET where HEAD is refused), each
 * same-origin link target those pages name that the sitemap did not. Sequential, and never throws: a fetch that fails is a
 * page with status 0 and its error. A browser's fetch hides a manual redirect's status, so run it in a Worker or Node.
 *
 * @param {CrawlInput} input
 * @returns {Promise<{ pages: AuditPage[], sitemap: string[], robots: string | null, lastmods: Record<string, string | null> }>}
 *   `robots` is `/robots.txt`'s text, null when it did not load as text; `lastmods` each sitemap URL's `lastmod` (null for
 *   none); pass both to `auditPages`
 */
export async function crawlSite({
  origin,
  fetch: fetcher,
  maxPages = 200,
  sitemapPath = "/sitemap.xml",
}) {
  const entries = await readSitemap(fetcher, new URL(sitemapPath, origin).href, origin, true);
  const sitemap = [...new Set(entries.map((entry) => entry.loc))];
  /** @type {Record<string, string | null>} */
  const lastmods = {};
  for (const entry of entries) lastmods[entry.loc] ??= entry.lastmod;
  const robots = await readRobots(fetcher, origin);
  /** @type {AuditPage[]} */
  const pages = [];
  const seen = new Set();

  for (let url of sitemap) {
    /** @type {string[]} */
    const chain = [];
    for (
      let hop = 0;
      hop <= MAX_HOPS && pages.length < maxPages && !seen.has(normalize(url));
      hop++
    ) {
      seen.add(normalize(url));
      const page = await fetchPage(fetcher, url, "GET", true);
      if (chain.length > 0) page.redirectedFrom = [...chain];
      pages.push(page);
      const next = isRedirect(page) ? resolve(page.location, url) : null;
      if (!next || new URL(next).origin !== origin) break;
      chain.push(url);
      url = next;
    }
  }

  for (const page of pages.filter((each) => each.html !== undefined)) {
    for (const url of internalLinks(/** @type {string} */ (page.html), page.url, origin)) {
      if (pages.length >= maxPages) return { pages, sitemap, robots, lastmods };
      if (seen.has(normalize(url))) continue;
      seen.add(normalize(url));
      const head = await fetchPage(fetcher, url, "HEAD", false);
      pages.push(
        head.status === 405 || head.status === 501
          ? await fetchPage(fetcher, url, "GET", false)
          : head,
      );
    }
  }
  return { pages, sitemap, robots, lastmods };
}

/** @param {typeof fetch} fetcher @param {string} origin @returns {Promise<string | null>} */
async function readRobots(fetcher, origin) {
  try {
    const response = await fetcher(`${origin}/robots.txt`);
    if (!response.ok || !/text\/plain/i.test(response.headers.get("content-type") ?? "")) {
      await response.body?.cancel();
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

/** @param {typeof fetch} fetcher @param {string} url @param {string} origin @param {boolean} index @returns {Promise<Array<{ loc: string, lastmod: string | null }>>} */
async function readSitemap(fetcher, url, origin, index) {
  let xml;
  try {
    const response = await fetcher(url);
    if (!response.ok) {
      await response.body?.cancel();
      return [];
    }
    xml = await response.text();
  } catch {
    return [];
  }
  const isIndex = /<sitemapindex\b/i.test(xml);
  const entries = [...xml.matchAll(/<(?:url|sitemap)\b[^>]*>([\s\S]*?)<\/(?:url|sitemap)>/gi)]
    .map((match) => ({
      loc: decodeEntities(/<loc>\s*([^<]*?)\s*<\/loc>/i.exec(match[1])?.[1] ?? ""),
      lastmod: /<lastmod>\s*([^<]*?)\s*<\/lastmod>/i.exec(match[1])?.[1] ?? null,
    }))
    .filter((entry) => entry.loc !== "" && sameOrigin(entry.loc, origin));
  if (!isIndex) return entries;
  if (!index) return [];
  const urls = [];
  for (const entry of entries) urls.push(...(await readSitemap(fetcher, entry.loc, origin, false)));
  return urls;
}

/** @param {typeof fetch} fetcher @param {string} url @param {"GET" | "HEAD"} method @param {boolean} body @returns {Promise<AuditPage>} */
async function fetchPage(fetcher, url, method, body) {
  try {
    const response = await fetcher(url, { method, redirect: "manual" });
    /** @type {Record<string, string>} */
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    /** @type {AuditPage} */
    const page = { url, status: response.status, headers };
    if (headers.location) page.location = headers.location;
    if (body && response.status === 200 && /html/i.test(headers["content-type"] ?? "text/html"))
      page.html = await response.text();
    else await response.body?.cancel();
    return page;
  } catch (error) {
    return { url, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Whether an alt is a file name: the image's own, with or without its extension, or any name ending in an image extension.
 * @param {string} alt @param {string | undefined} src
 */
function isFileName(alt, src) {
  const text = alt.trim().toLowerCase();
  if (!text) return false;
  if (/^[^\s/]+\.(avif|gif|jpe?g|png|svg|webp)$/.test(text)) return true;
  const name = (src ?? "").split(/[?#]/)[0].split("/").pop() ?? "";
  let file = name.toLowerCase();
  try {
    file = decodeURIComponent(file);
  } catch {
    // A malformed escape is compared as written.
  }
  return file !== "" && (text === file || text === file.replace(/\.[a-z0-9]+$/, ""));
}

/** @param {AuditPage} page */
function isRedirect(page) {
  return page.status >= 300 && page.status < 400;
}

/** The URLs a redirect passes through, from `page` to where the crawl stops, a loop cut at its first repeat. @param {AuditPage} page @param {Map<string, AuditPage>} byUrl */
function chainFrom(page, byUrl) {
  const hops = [page.url];
  /** @type {AuditPage | undefined} */
  let current = page;
  while (current && isRedirect(current)) {
    const next = resolve(current.location, current.url);
    if (!next || hops.some((url) => normalize(url) === normalize(next))) break;
    hops.push(next);
    current = byUrl.get(normalize(next));
  }
  return hops;
}

/** @param {Map<string, string[]>} map @param {string} key @param {string} url */
function push(map, key, url) {
  map.set(key, [...(map.get(key) ?? []), url]);
}

/** A URL without its fragment or a trailing slash, so `/a/` and `/a#top` name the page `/a` names. @param {string} url */
function normalize(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href.replace(/\/$/, "");
}

/** `href` made absolute against `base`, without its fragment, or null when it is no URL. @param {string | undefined} href @param {string} base */
function resolve(href, base) {
  if (!href) return null;
  try {
    const url = new URL(href, base);
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

/** @param {string} url @param {string} origin */
function sameOrigin(url, origin) {
  const resolved = resolve(url, origin);
  return resolved !== null && new URL(resolved).origin === origin;
}

/**
 * The same-origin `<a href>` targets in a page, absolute and without fragments, as written (not normalized). A
 * rel="nofollow" link, such as a sign-in link, is one the site asks crawlers not to follow, so it is left out.
 * @param {string} html @param {string} base @param {string} origin
 */
function internalLinks(html, base, origin) {
  /** @type {string[]} */
  const urls = [];
  for (const { href, rel } of tags(html, "a")) {
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    if (rel && /(^|\s)nofollow(\s|$)/i.test(rel)) continue;
    const url = resolve(href, base);
    if (url && new URL(url).origin === origin && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/** @param {Record<string, string> | Headers | undefined} headers @param {string} name */
function header(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return /** @type {Headers} */ (headers).get(name) ?? "";
  const key = Object.keys(headers).find((each) => each.toLowerCase() === name);
  return key ? /** @type {Record<string, string>} */ (headers)[key] : "";
}

/** @param {string} html */
function headOf(html) {
  const end = html.search(/<\/head>/i);
  return end === -1 ? html : html.slice(0, end);
}

/** @param {string} html @param {string} name */
function textOf(html, name) {
  const match = html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : null;
}

/** @param {string} html @param {"name" | "property"} key @param {string} value */
function meta(html, key, value) {
  return tags(html, "meta").find((attrs) => attrs[key]?.toLowerCase() === value)?.content ?? null;
}

/** @param {string} html */
function jsonLdBlocks(html) {
  return [
    ...html.matchAll(
      /<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => match[1]);
}

/**
 * Every `<name ...>` tag's attributes, values entity-decoded; an attribute with no value is the empty string.
 *
 * @param {string} html
 * @param {string} name
 * @returns {Array<Record<string, string>>}
 */
function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((match) => {
    /** @type {Record<string, string>} */
    const attrs = {};
    for (const attr of match[1].matchAll(
      /([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,
    )) {
      attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    return attrs;
  });
}

/** @param {string} text */
function decodeEntities(text) {
  // One pass, so "&amp;lt;" stays "&lt;"; numeric references cover the &#x27; and &#8217; that sites write.
  const named = { quot: '"', apos: "'", lt: "<", gt: ">", amp: "&", nbsp: "\u00a0" };
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|(quot|apos|lt|gt|amp|nbsp));/gi,
    (whole, hex, dec, name) => {
      if (name) return named[/** @type {keyof typeof named} */ (name.toLowerCase())];
      const code = Number.parseInt(hex ?? dec, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    },
  );
}

/**
 * @typedef {{ allow: boolean, path: string }} Rule
 * @typedef {Rule[]} Group
 */

/**
 * The rules that apply to one crawler, as RFC 9309 picks them: the group naming it, else `*`; groups are not combined.
 *
 * @param {string} text robots.txt
 * @param {string} agent lower-case product token, e.g. `googlebot`
 * @returns {Group}
 */
function robotsGroup(text, agent) {
  /** @type {Array<{ agents: string[], rules: Rule[] }>} */
  const groups = [];
  let open = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!open) groups.push({ agents: [], rules: [] });
      groups[groups.length - 1].agents.push(value.toLowerCase());
      open = true;
    } else if (key === "allow" || key === "disallow") {
      open = false;
      if (groups.length > 0 && value !== "")
        groups[groups.length - 1].rules.push({ allow: key === "allow", path: value });
    } else open = false;
  }
  const named = groups.filter((group) => group.agents.includes(agent));
  const chosen = named.length > 0 ? named : groups.filter((group) => group.agents.includes("*"));
  return chosen.flatMap((group) => group.rules);
}

/** Longest matching rule wins, and Allow wins a tie (RFC 9309 2.2.2). @param {Group} rules @param {string} path */
function robotsAllows(rules, path) {
  let best = { allow: true, length: -1 };
  for (const rule of rules) {
    const pattern = new RegExp(
      `^${rule.path
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\\\$$/, "$")}`,
    );
    if (!pattern.test(path)) continue;
    const length = rule.path.length;
    if (length > best.length || (length === best.length && rule.allow))
      best = { allow: rule.allow, length };
  }
  return best.allow;
}

/**
 * What Google's structured-data pages call required, for the types a page of these sites carries; a block that parses can
 * still earn no rich result. Walks `@graph`. Only what Google documents as required is flagged, never what is merely
 * recommended (https://developers.google.com/search/docs/appearance/structured-data/breadcrumb,
 * https://developers.google.com/search/docs/appearance/structured-data/video).
 *
 * @param {unknown} data
 * @returns {string[]}
 */
function jsonLdProblems(data) {
  /** @type {string[]} */
  const problems = [];
  const visit = (/** @type {unknown} */ node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const record = /** @type {Record<string, any>} */ (node);
    if (record["@graph"]) visit(record["@graph"]);
    const types = [record["@type"]].flat().filter(Boolean);
    if (types.includes("BreadcrumbList")) {
      const items = Array.isArray(record.itemListElement) ? record.itemListElement : [];
      if (items.length === 0) problems.push("a BreadcrumbList has no itemListElement");
      items.forEach((/** @type {Record<string, any>} */ item, /** @type {number} */ index) => {
        const last = index === items.length - 1;
        if (typeof item?.position !== "number" || !item?.name || (!last && !item?.item))
          problems.push(
            `BreadcrumbList item ${index + 1} lacks ${typeof item?.position !== "number" ? "a position" : !item?.name ? "a name" : "an item URL"}`,
          );
      });
    }
    if (types.includes("VideoObject")) {
      const missing = ["name", "thumbnailUrl", "uploadDate"].filter((key) => !record[key]);
      if (missing.length > 0) problems.push(`a VideoObject lacks ${missing.join(", ")}`);
    }
    if (types.includes("FAQPage")) {
      const questions = [record.mainEntity].flat().filter(Boolean);
      if (
        questions.length === 0 ||
        questions.some((question) => !question.name || !question.acceptedAnswer?.text)
      )
        problems.push("a FAQPage question lacks its name or accepted answer text");
    }
  };
  visit(data);
  return problems;
}
