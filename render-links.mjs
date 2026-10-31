// The family's link contract (Dustin, 2026-10-31): every author link in a rendered body says what kind of link it is, on the `a`, so
// Capsomer styles it from the markup alone. Prelum writes the markup and does not depend on Capsomer: the family list
// (Capsomer's FAMILY_SITES) is passed in by the site, as the chart frame's markup is written here without importing it.
//
//   data-link="away" rel="external"     a host that is neither the site's own nor a family site
//   data-link="family" data-site="<id>"  a family site
//   data-link="file"                     a file by its extension; a following span.cap-link-meta says "PDF, 2 MB"
//   data-link="jump"                     a same-page #fragment
//   data-link="email" | "phone"          mailto: and tel:
//   data-link="lang" hreflang            :lang[[text](url)]{hreflang=es}; a following span.cap-link-meta names the language in itself
//   data-link="address"                  the text is the link's own URL, a DOI or an email address
//   data-link="next"                     the paragraph's only content
//   data-link="xref"                     :xref[[text](url)], the author's cross-reference
//
// One kind per link, the first that fits of xref, lang, jump, file, address, email, phone, next, family and away. The host facts are not a kind: any link
// off the family carries rel="external" and the hidden "(opens another site)", and any link to a family site its data-site, whatever
// its kind. Footnote references and the pipeline's own links (heading anchors, image links, buttons, bookmarks, embeds, a chart's CSV
// download) keep their markup: each has a class or a footnote or download attribute, and an author's link has none.

import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

import { ContentError } from "./render-error.mjs";
import { LINK_ICON_PATH, linkIconSrc, lookupLinkIcon } from "./render-link-icons.mjs";
import { isAllowedUrl } from "./render-url.mjs";

/** The directives this module handles; CORE_DIRECTIVES lists them so the unknown-directive guard lets them through. */
export const LINK_DIRECTIVES = ["lang", "xref"];

/**
 * The extensions that make a link a file, and the word for each. Only the URL's path is read, so `?format=pdf`, `#notes.pdf` and a
 * bare `https://example.zip` are not files. Pages that end in a dot-word (.html, .md, .txt, .xml, .json) are left out: llms.txt, a
 * feed and a page's Markdown copy are read in the browser, not saved.
 */
const FILE_TYPES = new Map([
  ...["pdf", "csv", "tsv", "rtf", "epub", "zip", "gz", "7z", "mp3", "m4a", "wav", "flac", "mp4", "mov", "webm", "png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "ics", "bib", "ris"].map(
    (ext) => /** @type {[string, string]} */ ([ext, ext === "jpeg" ? "JPG" : ext.toUpperCase()]),
  ),
  ["doc", "Word"],
  ["docx", "Word"],
  ["xls", "Excel"],
  ["xlsx", "Excel"],
  ["ppt", "PowerPoint"],
  ["pptx", "PowerPoint"],
  ["odt", "OpenDocument text"],
  ["ods", "OpenDocument spreadsheet"],
  ["odp", "OpenDocument presentation"],
]);

const AWAY_WORDS = " (opens another site)";

/** A DOI as written in text, `10.1234/abc` or `doi:10.1234/abc` (Crossref's display guidelines). */
const DOI = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i;

/** @param {string} href */
const bareHost = (href) => {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

/** The path a URL names, for its extension; "" when it does not parse. @param {string} href */
const pathOf = (href) => {
  try {
    return new URL(href, "https://x.invalid/").pathname;
  } catch {
    return "";
  }
};

/** What a URL and its text are compared as: no scheme, no www., no trailing slash, case folded. @param {string} value */
const asAddress = (value) =>
  value
    .trim()
    .replace(/^(?:https?:\/\/|mailto:)/i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLowerCase();

/** @param {string} value */
const decodeOrSelf = (value) => {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
};

/** @param {number} n bytes */
const sizeWords = (n) => {
  if (n < 1024) return `${n} bytes`;
  const [value, unit] = n < 1024 ** 2 ? [n / 1024, "KB"] : n < 1024 ** 3 ? [n / 1024 ** 2, "MB"] : [n / 1024 ** 3, "GB"];
  // One decimal under 10 (1.4 MB), whole above (12 MB), and never "2.0".
  return `${value < 10 ? Number(value.toFixed(1)) : Math.round(value)} ${unit}`;
};

/**
 * The language's own name for itself, capitalized as that language writes a sentence's first word: "Español", "Português (Brasil)".
 * A runtime without the locale data returns the code, which is still the right meta.
 *
 * @param {string} tag a canonical BCP 47 tag
 */
const languageName = (tag) => {
  try {
    const name = new Intl.DisplayNames([tag], { type: "language" }).of(tag) ?? tag;
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    return tag;
  }
};

/**
 * `:lang[[Leer en español](https://es.example.com/)]{hreflang=es}` and `:xref[[Figure 2](#figure-2)]`: the directive syntax Prelum
 * already has (remark-directive's attributes, as `:abbr[]{title}` uses), wrapped round an ordinary link so the link stays a link in
 * the Markdown copy and on GitHub. Each holds exactly one link and becomes it; the tag is canonicalized (es-mx is es-MX), and one
 * Intl does not know is refused rather than written.
 *
 * @param {string} file
 */
export function remarkLinkDirectives(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "textDirective", (node, index, parent) => {
      if (!LINK_DIRECTIVES.includes(node.name) || !parent || index === undefined) return;
      const line = node.position?.start?.line;
      const where = `:${node.name}${line ? ` on line ${line} of the body` : ""}`;
      const children = node.children.filter((child) => child.type !== "text" || child.value.trim() !== "");
      const link = children[0];
      if (children.length !== 1 || link?.type !== "link") {
        throw new ContentError(file, `${where} holds exactly one link: :${node.name}[[text](url)]${node.name === "lang" ? "{hreflang=es}" : ""}`);
      }
      /** @type {Record<string, string>} */
      let properties = { dataLink: "xref" };
      if (node.name === "lang") {
        const raw = node.attributes?.hreflang ?? "";
        /** @type {string | undefined} */
        let tag;
        try {
          tag = Intl.getCanonicalLocales(raw)[0];
        } catch {
          tag = undefined;
        }
        if (!tag) throw new ContentError(file, `${where} needs a language tag such as {hreflang=es}, not ${JSON.stringify(raw)}`);
        properties = { hrefLang: tag };
      }
      link.data = { ...link.data, hProperties: { .../** @type {any} */ (link.data)?.hProperties, ...properties } };
      parent.children[index] = link;
    });
  };
}

/**
 * @typedef {object} LinkOptions
 * @property {string} [origin] The site's own origin. Without it no link is called away: a link to the site's own absolute URL would be.
 * @property {ReadonlyArray<{ id: string, href: string }>} [family] The family's sites: Capsomer's FAMILY_SITES, passed in by the site.
 * @property {(href: string) => Promise<number | null | undefined>} [fileSize] A file's size in bytes, or null when it is not known, in
 *   which case the meta names only the type.
 *
 * @typedef {import("./render-link-icons.mjs").LinkIconOptions} LinkIconOptions
 */

/**
 * Runs after the image links exist (so it can tell them from an author's link) and before the URL policy, which still sees every
 * href. Words are counted before it, so the hidden text and the meta are not in `words` or the excerpt.
 *
 * @param {LinkOptions} links
 * @param {LinkIconOptions | undefined} icons
 * @param {Array<Promise<void>>} pending
 */
export function rehypeLinks(links, icons, pending) {
  const own = links.origin ? bareHost(links.origin) : null;
  const family = new Map((links.family ?? []).map((site) => [bareHost(site.href), site.id]));
  const iconPath = icons?.path ?? LINK_ICON_PATH;
  // One lookup per file and per host in a render, as resolveImage is.
  /** @type {Map<string, Promise<number | null | undefined>>} */
  const sizes = new Map();
  /** @type {Map<string, Promise<string | null>>} */
  const hosts = new Map();

  return (/** @type {import("hast").Root} */ tree) => {
    // A loose list's items are paragraphs: a list of links is not a run of "next" links.
    /** @type {WeakSet<object>} */
    const listed = new WeakSet();
    visit(tree, "element", (node) => {
      if (node.tagName === "li") for (const child of node.children) listed.add(child);
    });

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "a" || !parent || index === undefined) return;
      const p = node.properties ?? {};
      if (p.className || p.download !== undefined || p.dataFootnoteRef !== undefined || p.dataFootnoteBackref !== undefined) return;
      const href = String(p.href ?? "");
      // Left for rehypeUrlProtocols, which shows a blocked link as its markdown.
      if (!href || !isAllowedUrl(href)) return;

      const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
      const web = scheme === "http" || scheme === "https";
      const host = web ? bareHost(href) : href.startsWith("//") ? bareHost(`https:${href}`) : null;
      const site = host && host !== own ? family.get(host) : undefined;
      const away = Boolean(host && own && host !== own && site === undefined);
      const fileType = !scheme || web ? FILE_TYPES.get(/\.([a-z0-9]+)$/i.exec(pathOf(href))?.[1]?.toLowerCase() ?? "") : undefined;
      const text = hastToString(node).trim();
      const doi = DOI.exec(text)?.[1];
      const address = text !== "" && (asAddress(text) === asAddress(decodeOrSelf(href)) || Boolean(doi && decodeOrSelf(href).toLowerCase().includes(doi.toLowerCase())));
      const meaningful = parent.children.filter((child) => child.type !== "text" || child.value.trim() !== "");
      // A paragraph of the author's own (the pipeline's have a class: a transcript's, a button row), and a link with words: one around
      // an image alone is a picture, not a way on.
      const alone =
        parent.type === "element" &&
        parent.tagName === "p" &&
        !parent.properties?.className &&
        !listed.has(parent) &&
        meaningful.length === 1 &&
        text !== "" &&
        !node.children.some((child) => child.type === "element" && (child.tagName === "img" || child.tagName === "picture"));

      const kind =
        p.dataLink === "xref"
          ? "xref"
          : p.hrefLang
            ? "lang"
            : href.startsWith("#")
              ? "jump"
              : fileType
                ? "file"
                : address
                  ? "address"
                  : scheme === "mailto"
                    ? "email"
                    : scheme === "tel"
                      ? "phone"
                      : alone
                        ? "next"
                        : site !== undefined
                          ? "family"
                          : away
                            ? "away"
                            : null;
      if (!kind) return;
      node.properties = {
        ...p,
        dataLink: kind,
        ...(site !== undefined ? { dataSite: site } : {}),
        ...(away ? { rel: ["external"] } : {}),
      };
      if (away) node.children.push({ type: "element", tagName: "span", properties: { className: ["cap-sr-only"] }, children: [{ type: "text", value: AWAY_WORDS }] });

      /** @type {import("hast").Element | null} */
      let meta = null;
      if (kind === "file") {
        meta = { type: "element", tagName: "span", properties: { className: ["cap-link-meta"] }, children: [{ type: "text", value: String(fileType) }] };
        const shown = meta;
        if (links.fileSize) {
          if (!sizes.has(href)) sizes.set(href, links.fileSize(href));
          pending.push(
            /** @type {Promise<number | null | undefined>} */ (sizes.get(href)).then((bytes) => {
              // Never guessed: an unknown or nonsensical size leaves the type alone.
              if (typeof bytes === "number" && Number.isFinite(bytes) && bytes >= 0) shown.children = [{ type: "text", value: `${fileType}, ${sizeWords(Math.round(bytes))}` }];
            }),
          );
        }
      } else if (kind === "lang") {
        const tag = String(p.hrefLang);
        meta = { type: "element", tagName: "span", properties: { className: ["cap-link-meta"], lang: tag }, children: [{ type: "text", value: languageName(tag) }] };
      }
      // After the link, outside its name, with a space so the text still reads without the stylesheet (a feed, reader view).
      if (meta) parent.children.splice(index + 1, 0, { type: "text", value: " " }, meta);

      if (kind === "away" && icons && host) {
        if (!hosts.has(host)) hosts.set(host, lookupLinkIcon(host, icons));
        pending.push(
          /** @type {Promise<string | null>} */ (hosts.get(host)).then((type) => {
            const src = type ? linkIconSrc(iconPath, host, type) : null;
            // No icon: the link is left as it is, and Capsomer draws its arrow.
            if (src) node.children.unshift({ type: "element", tagName: "img", properties: { className: ["cap-link-icon"], src, alt: "", width: 16, height: 16 }, children: [] });
          }),
        );
      }
    });
  };
}
