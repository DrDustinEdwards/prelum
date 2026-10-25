import { SERP_DESCRIPTION_LIMIT, SERP_TITLE_LIMIT } from "./head.mjs";

/**
 * @typedef {object} AuditPage
 * @property {string} url absolute
 * @property {number} status the HTTP status the crawl got
 * @property {string} [html] the body, for a 200
 * @property {string} [location] where a 3xx pointed
 * @property {boolean} [inSitemap]
 */

/**
 * @typedef {object} AuditFinding
 * @property {string} url
 * @property {string} check
 * @property {"error" | "warning"} severity error: search engines get it wrong; warning: worse results
 * @property {string} detail
 */

/**
 * The checks a crawler-based site audit runs (the ones Semrush and Ahrefs lead with), over pages a crawl already fetched:
 * Cloudflare Browser Run's `/crawl`, or a site's own test fetching its sitemap. It reads only the tags `headTags` writes and
 * the links in the page, so it needs no HTML parser.
 *
 * @param {AuditPage[]} pages
 * @param {{ origin: string }} site
 * @returns {AuditFinding[]}
 */
export function auditPages(pages, { origin }) {
  /** @type {AuditFinding[]} */
  const findings = [];
  const add = (/** @type {string} */ url, /** @type {string} */ check, /** @type {"error" | "warning"} */ severity, /** @type {string} */ detail) =>
    findings.push({ url, check, severity, detail });
  const byUrl = new Map(pages.map((page) => [normalize(page.url), page]));
  /** @type {Map<string, string[]>} */
  const titles = new Map();
  /** @type {Map<string, string[]>} */
  const descriptions = new Map();

  for (const page of pages) {
    const { url } = page;
    if (page.status >= 300 && page.status < 400) {
      const next = page.location ? byUrl.get(normalize(new URL(page.location, url).href)) : undefined;
      if (next && next.status >= 300 && next.status < 400) add(url, "redirect-chain", "warning", `${url} -> ${next.url} -> ${next.location}`);
      if (page.inSitemap) add(url, "sitemap-redirect", "error", "the sitemap lists a URL that redirects");
      continue;
    }
    if (page.status !== 200) {
      if (page.inSitemap) add(url, "sitemap-broken", "error", `the sitemap lists a URL that answers ${page.status}`);
      continue;
    }
    const html = page.html ?? "";
    const head = headOf(html);

    const title = textOf(head, "title");
    if (!title) add(url, "title-missing", "error", "no <title>");
    else {
      if (title.length > SERP_TITLE_LIMIT) add(url, "title-long", "warning", `${title.length} characters; results clip at about ${SERP_TITLE_LIMIT}`);
      push(titles, title, url);
    }

    const description = meta(head, "name", "description");
    if (!description) add(url, "description-missing", "error", "no meta description");
    else {
      if (description.length > SERP_DESCRIPTION_LIMIT) {
        add(url, "description-long", "warning", `${description.length} characters; results clip at about ${SERP_DESCRIPTION_LIMIT}`);
      }
      push(descriptions, description, url);
    }

    const canonical = tags(head, "link").find((attrs) => attrs.rel?.toLowerCase() === "canonical")?.href;
    if (!canonical) add(url, "canonical-missing", "error", "no canonical link");
    else if (!canonical.startsWith(`${origin}/`) && canonical !== origin) {
      add(url, "canonical-off-site", "error", `the canonical is ${canonical}, not on ${origin}`);
    }

    const robots = meta(head, "name", "robots") ?? "";
    if (page.inSitemap && /noindex/i.test(robots)) add(url, "sitemap-noindex", "error", "the sitemap lists a noindex page");
    if (!meta(head, "property", "og:image")) add(url, "card-missing", "warning", "no og:image, so a shared link has no card");

    for (const script of jsonLdBlocks(html)) {
      try {
        JSON.parse(script);
      } catch {
        add(url, "jsonld-invalid", "error", "a JSON-LD block does not parse");
      }
    }
    for (const img of tags(html, "img")) {
      if (img.alt === undefined) add(url, "image-alt-missing", "warning", `no alt on ${img.src ?? "an image"}`);
    }
    for (const href of new Set(tags(html, "a").map((attrs) => attrs.href).filter(Boolean))) {
      const target = linkTarget(/** @type {string} */ (href), url, origin);
      if (!target) continue;
      const linked = byUrl.get(target);
      if (linked && linked.status >= 400) add(url, "link-broken", "error", `links to ${linked.url}, which answers ${linked.status}`);
    }
  }

  for (const [title, urls] of titles) if (urls.length > 1) for (const url of urls) add(url, "title-duplicate", "warning", `"${title}" is on ${urls.length} pages`);
  for (const [, urls] of descriptions) if (urls.length > 1) for (const url of urls) add(url, "description-duplicate", "warning", `the same description is on ${urls.length} pages`);
  return findings;
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

/** @param {string} href @param {string} base @param {string} origin */
function linkTarget(href, base, origin) {
  if (/^(mailto|tel|javascript|data):/i.test(href) || href.startsWith("#")) return null;
  try {
    const url = new URL(decodeEntities(href), base);
    return url.origin === origin ? normalize(url.href) : null;
  } catch {
    return null;
  }
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
  return [...html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
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
    for (const attr of match[1].matchAll(/([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      attrs[attr[1].toLowerCase()] = decodeEntities(attr[2] ?? attr[3] ?? attr[4] ?? "");
    }
    return attrs;
  });
}

/** @param {string} text */
function decodeEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
