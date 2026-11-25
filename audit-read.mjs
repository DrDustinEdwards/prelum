// The readers behind auditPages and crawlSite: URLs, head tags, robots rules and JSON-LD, over HTML as text.

import { htmlAttributes, unescapeHtml } from "@dustinedwards/site-runtime/html";

/** @typedef {import("./audit.mjs").AuditPage} AuditPage */

/**
 * Whether an alt is a file name: the image's own, with or without its extension, or any name ending in an image extension.
 * @param {string} alt @param {string | undefined} src
 */
export function isFileName(alt, src) {
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

/** Whether a page's canonical is the page itself, so it asks to be indexed at this URL. @param {string} head @param {string} url */
export function selfCanonical(head, url) {
  const href = tags(head, "link").find((attrs) => attrs.rel?.toLowerCase() === "canonical")?.href;
  const canonical = resolve(href, url);
  return canonical !== null && same(canonical, url);
}

/** @param {AuditPage} page */
export function isRedirect(page) {
  return page.status >= 300 && page.status < 400;
}

/** The URLs a redirect passes through, from `page` to where the crawl stops, a loop cut at its first repeat. @param {AuditPage} page @param {Map<string, AuditPage>} byUrl */
export function chainFrom(page, byUrl) {
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
export function push(map, key, url) {
  map.set(key, [...(map.get(key) ?? []), url]);
}

/** A URL without its fragment or, unless `exact`, a trailing slash, so `/a/` and `/a#top` name the page `/a` names. @param {string} url @param {boolean} [exact] */
export function normalize(url, exact = false) {
  const parsed = new URL(url);
  parsed.hash = "";
  return exact ? parsed.href : parsed.href.replace(/\/$/, "");
}

/** The same page, slash included. @param {string} a @param {string} b */
export const same = (a, b) => normalize(a, true) === normalize(b, true);

/** `href` made absolute against `base`, without its fragment, or null when it is no URL. @param {string | undefined} href @param {string} base */
export function resolve(href, base) {
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
export function sameOrigin(url, origin) {
  const resolved = resolve(url, origin);
  return resolved !== null && new URL(resolved).origin === origin;
}

/**
 * The same-origin `<a href>` targets in a page, absolute and without fragments, as written (not normalized). A
 * rel="nofollow" link, such as a sign-in link, is one the site asks crawlers not to follow, so it is left out.
 * @param {string} html @param {string} base @param {string} origin
 */
export function internalLinks(html, base, origin) {
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
export function header(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return /** @type {Headers} */ (headers).get(name) ?? "";
  const key = Object.keys(headers).find((each) => each.toLowerCase() === name);
  return key ? /** @type {Record<string, string>} */ (headers)[key] : "";
}

/** @param {string} html */
export function headOf(html) {
  const end = html.search(/<\/head>/i);
  return end === -1 ? html : html.slice(0, end);
}

/** @param {string} html @param {string} name */
export function textOf(html, name) {
  const match = html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return match ? unescapeHtml(match[1]).trim() : null;
}

/** @param {string} html @param {"name" | "property"} key @param {string} value */
export function meta(html, key, value) {
  return tags(html, "meta").find((attrs) => attrs[key]?.toLowerCase() === value)?.content ?? null;
}

/** @param {string} html */
export function jsonLdBlocks(html) {
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
export function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b((?:[^>"']|"[^"]*"|'[^']*')*)>`, "gi"))].map(
    (match) => /** @type {Record<string, string>} */ (htmlAttributes(match[1])),
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
export function robotsGroup(text, agent) {
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
export function robotsAllows(rules, path) {
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
export function jsonLdProblems(data) {
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
    if (types.includes("Dataset")) {
      const missing = ["name", "description"].filter((key) => !record[key]);
      if (missing.length > 0) problems.push(`a Dataset lacks ${missing.join(", ")}`);
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
