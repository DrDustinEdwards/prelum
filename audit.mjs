import { SERP_DESCRIPTION, SERP_TITLE, serpWidth } from "./serp.mjs";
import {
  chainFrom,
  header,
  headOf,
  internalLinks,
  isFileName,
  isRedirect,
  jsonLdBlocks,
  jsonLdProblems,
  meta,
  normalize,
  push,
  resolve,
  robotsAllows,
  robotsGroup,
  same,
  selfCanonical,
  tags,
  textOf,
} from "./audit-read.mjs";

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

/** A redirect to a sign-in page is a page that needs an account, not a link that moved. */
const isSignInGate = (/** @type {string | undefined} */ location) =>
  /^\/(log-?in|sign-?in|auth)(\/|$|\?)/i.test(location ?? "");

/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * `crawlSite`, Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags`
 * writes and the links in the page, so it needs no HTML parser. Pure: it fetches nothing.
 *
 * @param {AuditPage[]} pages
 * @param {{ origin: string, sitemap?: string[], robots?: string | null, lastmods?: Record<string, string | null>, preview?: boolean }} site `origin` is the production origin every canonical
 *   must be on; `sitemap` the URLs the sitemap lists (a page's own `inSitemap` counts too), and an empty list is itself a
 *   finding; `robots` the text of `/robots.txt` (`crawlSite` returns it, null when it did not load), left out to skip the
 *   robots checks; `lastmods` the sitemap's `lastmod` per URL (null for none), which `crawlSite` returns, left out to skip the
 *   lastmod checks; `preview` marks pages served from a workers.dev address, whose robots.txt and X-Robots-Tag keep the preview
 *   out of search on purpose, so neither is held against the site; a noindex meta still is
 * @returns {AuditReport}
 */
export function auditPages(pages, { origin, sitemap, robots: robotsText, lastmods, preview }) {
  /** @type {AuditFinding[]} */
  const findings = [];
  const add = (
    /** @type {string} */ url,
    /** @type {string} */ check,
    /** @type {"error" | "warning" | "unmeasured"} */ severity,
    /** @type {string} */ detail,
  ) => findings.push({ url, check, severity, detail });
  const byUrl = new Map(pages.map((page) => [normalize(page.url), page]));
  const listed = new Set((sitemap ?? []).map((entry) => normalize(entry)));
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

  /** @type {import("./audit-read.mjs").Group | null} */
  let googlebot = null;
  if (robotsText === null)
    add(`${origin}/robots.txt`, "robots-missing", "warning", "robots.txt did not load as text");
  else if (robotsText !== undefined && !preview) {
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
    // Every robots meta counts, as Google combines them, and the header with them.
    const robots = [
      ...tags(head, "meta")
        .filter((attrs) => attrs.name?.toLowerCase() === "robots")
        .map((attrs) => attrs.content ?? ""),
      preview ? "" : header(page.headers, "x-robots-tag"),
    ].join(" ");
    const { pathname, search } = new URL(url);
    // A page the site links to but does not list: a noindex or robots-disallowed one is meant to stay out of search, so
    // nothing more is asked of it; any other is a page search engines find only by following links. A URL with a query
    // (a list's second page, a filter) is a variant of a page, not one a sitemap must name.
    if (!inSitemap(page)) {
      if (/noindex/i.test(robots) || (googlebot && !robotsAllows(googlebot, pathname + search)))
        continue;
      if (sitemap && sitemap.length > 0 && !search && selfCanonical(head, url))
        add(
          url,
          "sitemap-missing",
          "error",
          "an indexable page the site links to is not in the sitemap, so search engines find it only by following links",
        );
    }

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
    if (meta(head, "name", "text-scale")?.trim().toLowerCase() !== "scale")
      add(
        url,
        "text-scale-missing",
        "warning",
        'no <meta name="text-scale" content="scale">, so a phone keeps the page at its default size and ignores the reader\'s system text size',
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
      if (!search) push(titles, title, url);
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
      if (!search) push(descriptions, description, url);
    }

    const canonicals = tags(head, "link").filter(
      (attrs) => attrs.rel?.toLowerCase() === "canonical",
    );
    const canonical = resolve(canonicals[0]?.href, url);
    if (new Set(canonicals.map((attrs) => resolve(attrs.href, url))).size > 1)
      add(
        url,
        "canonical-multiple",
        "error",
        "more than one canonical link, and they differ, so Google ignores them all",
      );
    const ogUrl = meta(head, "property", "og:url");
    if (ogUrl && canonical && !same(resolve(ogUrl, url) ?? ogUrl, canonical))
      add(url, "og-url-mismatch", "warning", `og:url ${ogUrl} is not the canonical ${canonical}`);
    if (!canonical) add(url, "canonical-missing", "error", "no canonical link");
    else if (new URL(canonical).origin !== origin)
      add(url, "canonical-off-site", "error", `the canonical is ${canonical}, not on ${origin}`);
    else if (inSitemap(page) && !same(canonical, url)) {
      add(
        url,
        "canonical-elsewhere",
        "error",
        `the sitemap lists this page, but its canonical is ${canonical}`,
      );
    }

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
    for (const target of new Set(internalLinks(html, url, origin).map((link) => normalize(link)))) {
      const linked = byUrl.get(target);
      if (!linked) continue;
      if (linked.status >= 400)
        add(url, "link-broken", "error", `links to ${linked.url}, which answers ${linked.status}`);
      else if (isRedirect(linked) && !isSignInGate(linked.location))
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

export { crawlSite } from "./audit-crawl.mjs";
