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
 *   | { tagName: "link", rel: string, href: string }
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
 */

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
  const url = input.canonical ?? absoluteUrl(origin, path);
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
  if (noindex) tags.push({ name: "robots", content: "noindex, follow" });
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
      if ("title" in tag) return `<title>${escapeXml(tag.title)}</title>`;
      if ("script:ld+json" in tag) {
        return `<script type="application/ld+json">${jsonLdText(tag["script:ld+json"])}</script>`;
      }
      if ("tagName" in tag) return `<link rel="${escapeXml(tag.rel)}" href="${escapeXml(tag.href)}">`;
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
