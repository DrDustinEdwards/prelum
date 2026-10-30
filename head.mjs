import { escapeXml, jsonLdText, toDate } from "./xml.mjs";

/**
 * Google truncates by pixel width (about 600px title, 920px description), so these approximate it; a 160-character counter
 * would show text the result clips.
 */
export const SERP_TITLE_LIMIT = 60;
export const SERP_DESCRIPTION_LIMIT = 155;

/**
 * @typedef {{ title: string }
 *   | { name: string, content: string }
 *   | { property: string, content: string }
 *   | { tagName: "link", rel: string, href: string, type?: string, title?: string }
 *   | { "script:ld+json": Record<string, unknown> }} HeadTag
 * The descriptor shapes React Router's `meta` export takes, so a route returns `headTags(...)` as it is.
 */

/**
 * @typedef {object} HeadImage
 * @property {string} url absolute, or a path on `origin`
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [alt]
 */

/**
 * @typedef {object} ArticleFacts
 * @property {Date | number | string | null} [published]
 * @property {Date | number | string | null} [modified] falls back to `published`
 * @property {string} [author]
 * @property {string[]} [tags]
 */

/**
 * @typedef {object} HeadInput
 * @property {string} origin the site's production origin, never the request's: a workers.dev copy must not claim to be the page
 * @property {string} path
 * @property {string} title the `<title>`, with any site suffix already on it
 * @property {string} description
 * @property {HeadImage | string} image the page's card, or the site's default: a card is always sent
 * @property {string} [siteName]
 * @property {string} [socialTitle] `og:title` and `twitter:title`, where they differ from `title`
 * @property {string} [socialDescription]
 * @property {"website" | "article" | "book" | "profile"} [type]
 * @property {string} [canonical] an absolute URL, where it is not `origin` + `path`
 * @property {string} [locale] e.g. `en_US`
 * @property {boolean} [noindex]
 * @property {ArticleFacts} [article] `article:*` tags; pass the same facts to the schema's `article` so the two agree
 * @property {string} [markdown] the page's Markdown copy (`markdownPath(path)` from `llms`), absolute or a path on `origin`, linked as
 *   `<link rel="alternate" type="text/markdown">` so an agent can find it
 * @property {HeadFeed[]} [feeds] the site's or the page's feeds, each linked as `<link rel="alternate">` so a reader finds it
 * @property {boolean} [keepTrailingSlash] keep a trailing slash on `path` in the canonical and `og:url`; by default
 *   `/about/` is written `/about` (the home page stays `/`), so one page has one canonical URL. A route served only with its
 *   slash (a podcast feed's page at `/feed/podcast/`) keeps it.
 */

/**
 * @typedef {object} HeadFeed
 * @property {"rss" | "atom" | "json" | (string & {})} type `rss`, `atom` and `json` name the usual media types; any other
 *   value is written as the type
 * @property {string} href absolute, or a path on `origin`
 * @property {string} [title] e.g. "Germomics (RSS)"
 */

/** @type {Record<string, string>} */
const FEED_TYPES = {
  rss: "application/rss+xml",
  atom: "application/atom+xml",
  json: "application/feed+json",
};

/**
 * The full head of a public page: title, description, canonical, Open Graph and Twitter. `twitter:card` is always
 * `summary_large_image`, because the image is required: a card without one renders as a bare link. An absent date writes no
 * tag, since an empty `article:published_time` claims there is no date.
 *
 * @param {HeadInput} input
 * @returns {HeadTag[]}
 */
export function headTags(input) {
  const { origin, path, title, description, siteName, type = "website", locale, noindex, article } = input;
  const url = input.canonical ?? absoluteUrl(origin, input.keepTrailingSlash ? path : withoutTrailingSlash(path));
  const image = typeof input.image === "string" ? { url: input.image } : input.image;
  const imageUrl = absoluteUrl(origin, image.url);
  const socialTitle = input.socialTitle ?? title;
  const socialDescription = input.socialDescription ?? description;

  /** @type {HeadTag[]} */
  const tags = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
  ];
  if (input.markdown) tags.push({ tagName: "link", rel: "alternate", type: "text/markdown", href: absoluteUrl(origin, input.markdown) });
  for (const feed of input.feeds ?? []) {
    /** @type {HeadTag} */
    const link = { tagName: "link", rel: "alternate", type: FEED_TYPES[feed.type] ?? feed.type, href: absoluteUrl(origin, feed.href) };
    if (feed.title) link.title = feed.title;
    tags.push(link);
  }
  // Without max-image-preview:large, Google shows only a thumbnail of the card in Discover and image results.
  tags.push({ name: "robots", content: noindex ? "noindex, follow" : "max-image-preview:large" });
  if (siteName) tags.push({ property: "og:site_name", content: siteName });
  tags.push(
    { property: "og:type", content: type },
    { property: "og:title", content: socialTitle },
    { property: "og:description", content: socialDescription },
    { property: "og:url", content: url },
  );
  if (locale) tags.push({ property: "og:locale", content: locale });
  tags.push({ property: "og:image", content: imageUrl });
  if (image.width) tags.push({ property: "og:image:width", content: String(image.width) });
  if (image.height) tags.push({ property: "og:image:height", content: String(image.height) });
  if (image.alt) tags.push({ property: "og:image:alt", content: image.alt });
  if (article) tags.push(...articleTags(article));
  tags.push(
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: socialTitle },
    { name: "twitter:description", content: socialDescription },
    { name: "twitter:image", content: imageUrl },
  );
  if (image.alt) tags.push({ name: "twitter:image:alt", content: image.alt });
  return tags;
}

/** @param {ArticleFacts} article @returns {HeadTag[]} */
function articleTags(article) {
  const { published, modified } = articleDates(article);
  /** @type {HeadTag[]} */
  const tags = [];
  if (published) tags.push({ property: "article:published_time", content: published });
  if (modified) tags.push({ property: "article:modified_time", content: modified });
  if (article.author) tags.push({ property: "article:author", content: article.author });
  for (const tag of article.tags ?? []) tags.push({ property: "article:tag", content: tag });
  return tags;
}

/**
 * The ISO dates both the Open Graph tags and the Article schema write, so the two cannot disagree. A missing or unreadable
 * date is undefined.
 *
 * @param {ArticleFacts} article
 * @returns {{ published: string | undefined, modified: string | undefined }}
 */
export function articleDates(article) {
  const published = iso(article.published);
  return { published, modified: iso(article.modified) ?? published };
}

/** @param {Date | number | string | null | undefined} value */
function iso(value) {
  if (value === null || value === undefined) return undefined;
  const date = toDate(value, null);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** `/about/` is `/about`; `/` and an absolute URL are kept. @param {string} path */
function withoutTrailingSlash(path) {
  if (/^https?:\/\//.test(path)) return path;
  const bare = path.replace(/\/+(?=$|[?#])/, "");
  return bare === "" || /^[?#]/.test(bare) ? `/${bare}` : bare;
}

/**
 * A path on `origin` made absolute; an absolute URL is kept as it is.
 *
 * @param {string} origin
 * @param {string} path
 */
export function absoluteUrl(origin, path) {
  if (/^https?:\/\//.test(path)) return path;
  return `${origin.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The tags as HTML, for a page built without React Router (a static build). Attribute values are escaped, and JSON-LD is
 * written by `jsonLdText`, so a title holding `</script>` cannot end the script element.
 *
 * @param {HeadTag[]} tags
 * @returns {string}
 */
export function headHtml(tags) {
  return tags
    .map((tag) => {
      // A link first, as React Router reads them: a feed's link carries a `title` too.
      if ("tagName" in tag) {
        const type = tag.type ? ` type="${escapeXml(tag.type)}"` : "";
        const title = tag.title ? ` title="${escapeXml(tag.title)}"` : "";
        return `<link rel="${escapeXml(tag.rel)}"${type}${title} href="${escapeXml(tag.href)}">`;
      }
      if ("title" in tag) return `<title>${escapeXml(tag.title)}</title>`;
      if ("script:ld+json" in tag) {
        return `<script type="application/ld+json">${jsonLdText(tag["script:ld+json"])}</script>`;
      }
      const [key, value] = "property" in tag ? ["property", tag.property] : ["name", tag.name];
      return `<meta ${key}="${escapeXml(value)}" content="${escapeXml(tag.content)}">`;
    })
    .join("\n");
}

/**
 * Cut at a word boundary and mark the cut with "...", `limit` characters at most in all, for a title or description shown
 * where Google's result would clip it.
 *
 * @param {string} text
 * @param {number} limit
 */
export function truncateForSerp(text, limit) {
  if (text.length <= limit) return text;
  // The "..." counts toward the limit, and punctuation left before it goes, so the cut never reads ",...".
  const cut = text.slice(0, limit - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-–—]+$/, "")}...`;
}

/**
 * The `<title>` a search result shows: the title with the site's suffix where both fit, else the suffix dropped and the
 * title cut at a word. Only the `<title>` is shortened; pass the whole title as `socialTitle` and keep it in the heading.
 *
 * @param {string} title
 * @param {string} suffix e.g. " | Foxing"
 */
export function searchTitle(title, suffix) {
  const full = `${title}${suffix}`;
  return full.length <= SERP_TITLE_LIMIT ? full : truncateForSerp(title, SERP_TITLE_LIMIT);
}

/**
 * @typedef {object} SiteHead
 * @property {string} origin the site's production origin
 * @property {string} siteName `og:site_name`
 * @property {HeadImage | string} image the site's default card, for a page without its own
 * @property {string} [suffix] what follows a page's title in `<title>`, e.g. " | Foxing"; `searchTitle` drops it where the
 *   two do not fit
 * @property {string} [locale] `og:locale`, e.g. `en_US`
 * @property {HeadFeed[]} [feeds] the site's feeds, linked from every page
 * @property {Record<string, string>} [sections] the names of the section pages a breadcrumb trail passes through, by path
 *   (`{ "/blog": "Blog" }`); a path not named here is left out of the trail
 */

/**
 * @typedef {Omit<HeadInput, "origin" | "siteName" | "image" | "locale"> & {
 *   image?: HeadImage | string | null,
 *   fullTitle?: boolean,
 *   pageType?: string,
 *   breadcrumbs?: Array<{ name: string, path: string }> | false,
 * }} PageHead
 * One page's head: `title` is the page's own title, without the suffix, unless `fullTitle` says it is already the whole
 * `<title>`. `feeds` are added to the site's. `pageType` is the WebPage subtype (`CollectionPage` for a list, `AboutPage`,
 * `ProfilePage`, `SearchResultsPage`); `breadcrumbs` is the trail from the home page down, in place of the one built from
 * `sections`, or false for none.
 */

/**
 * The per-site head builder every site wrote around `headTags`: the site's facts once, then a function a route's `meta`
 * calls with the page's. The `<title>` is `searchTitle(title, suffix)` (the suffix dropped and the title cut where both do
 * not fit) and the share card keeps the whole title as `socialTitle`; the description is cut at a word to
 * `SERP_DESCRIPTION_LIMIT`, and the share card keeps it whole. An indexable page also gets its WebPage and BreadcrumbList
 * as one JSON-LD graph, joined to the site's `website` node by its `@id`, so no page goes without them.
 *
 * @param {SiteHead} site
 * @returns {(page: PageHead) => HeadTag[]}
 */
export function defineHead(site) {
  return ({ fullTitle, image, feeds, pageType, breadcrumbs, ...page }) => {
    const title = fullTitle ? page.title : searchTitle(page.title, site.suffix ?? "");
    const tags = headTags({
      ...page,
      origin: site.origin,
      siteName: site.siteName,
      locale: site.locale,
      image: image ?? site.image,
      title,
      socialTitle: page.socialTitle ?? (title === page.title ? undefined : page.title),
      description: truncateForSerp(page.description, SERP_DESCRIPTION_LIMIT),
      socialDescription: page.socialDescription ?? page.description,
      feeds: [...(site.feeds ?? []), ...(feeds ?? [])],
    });
    if (page.noindex) return tags;
    const url = page.canonical ?? absoluteUrl(site.origin, page.keepTrailingSlash ? page.path : withoutTrailingSlash(page.path));
    const trail = breadcrumbs === false ? [] : (breadcrumbs ?? sectionTrail(site, page.path, page.title));
    /** @type {Record<string, unknown>[]} */
    const nodes = [{
      "@type": pageType ?? "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": `${site.origin}/#website` },
      ...(trail.length > 1 ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    }];
    if (trail.length > 1) {
      nodes.push({
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: trail.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: absoluteUrl(site.origin, crumb.path) })),
      });
    }
    tags.push({ "script:ld+json": { "@context": "https://schema.org", "@graph": nodes } });
    return tags;
  };
}

/**
 * Home, each section above the page that `site.sections` names, then the page. The home page's trail is itself alone.
 *
 * @param {SiteHead} site
 * @param {string} path
 * @param {string} title
 */
function sectionTrail(site, path, title) {
  const bare = withoutTrailingSlash(path).replace(/[?#].*$/, "");
  if (bare === "/") return [{ name: site.siteName, path: "/" }];
  const parts = bare.split("/").filter(Boolean);
  const sections = parts.slice(0, -1).map((_, i) => `/${parts.slice(0, i + 1).join("/")}`).filter((p) => site.sections?.[p]);
  return [{ name: site.siteName, path: "/" }, ...sections.map((p) => ({ name: site.sections?.[p] ?? "", path: p })), { name: title, path: bare }];
}

/** @type {Record<string, string>} */
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•" };

/**
 * A meta tag's text from HTML (an excerpt, an abstract title): scripts, styles and tags dropped, entities decoded, white
 * space collapsed, then cut at a word to `limit` (by default `SERP_DESCRIPTION_LIMIT`; `Infinity` keeps it whole). An
 * entity it does not know is kept as written. The result is text, so it is escaped where it is written, as every tag is.
 *
 * @param {string} html
 * @param {number} [limit]
 */
export function metaText(html, limit = SERP_DESCRIPTION_LIMIT) {
  const text = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
      if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? entity;
      const code = decimal ? Number(decimal) : Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/\s+/g, " ")
    .trim();
  return truncateForSerp(text, limit);
}

/**
 * Minutes to read at 200 words a minute, rounded, never less than one. Words are runs of non-space, so Markdown syntax
 * counts, as the sites' published reading times were counted; pass HTML through `metaText(html, Infinity)` first.
 *
 * @param {string} text
 */
export function readingMinutes(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
