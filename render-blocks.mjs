// The blocks every site gets beyond :::figure and :::details, measured against Ghost's cards, WordPress's core blocks and GitHub's
// alerts: callouts, video, audio, embeds, galleries, buttons, bookmarks, FAQs, links to other posts and the inline marks raw HTML
// would otherwise be the only way to write. Each refuses what it cannot render well rather than guessing, as :::figure does.

import { visit } from "unist-util-visit";

import { refuseHeading, widthClass } from "./render-directives.mjs";
import { ContentError } from "./render-error.mjs";
import { isAllowedUrl } from "./render-url.mjs";

/** GitHub's five alert types, the syntax GitHub, Obsidian and Docusaurus read. */
export const CALLOUTS = /** @type {const} */ (["note", "tip", "important", "warning", "caution"]);

const CALLOUT_LINE = /^\[!(note|tip|important|warning|caution)\][ \t]*([^\n]*)(?:\n|$)/i;

/** `![""](x)`, straight or curly quotes: the author's word that the image is decorative. */
const DECORATIVE_ALT = /^(?:""|\u201c\u201d)$/;

const MEDIA_FILE = /\.(?:mp4|m4v|mov|webm|ogv|mp3|m4a|aac|oga|ogg|wav|flac)(?:[?#]|$)/i;

/** @param {any} node @param {string} name */
const where = (node, name) => {
  const line = node.position?.start?.line;
  return `${name}${line ? ` on line ${line} of the body` : ""}`;
};

/** @param {any} node @returns {Record<string, string>} */
const attrsOf = (node) => /** @type {Record<string, string>} */ (node.attributes ?? {});

/** @param {any} node @returns {string} */
const textOf = (node) => (typeof node.value === "string" ? node.value : (node.children ?? []).map(textOf).join(""));

/**
 * @param {string} file
 * @param {any} node
 * @param {string} name
 * @param {string} key
 * @param {boolean} [required]
 */
function urlAttribute(file, node, name, key, required = true) {
  const url = attrsOf(node)[key];
  if (!url) {
    if (required) throw new ContentError(file, `${where(node, name)} requires a ${key} attribute`);
    return undefined;
  }
  if (!isAllowedUrl(url)) throw new ContentError(file, `${where(node, name)} ${key} ${JSON.stringify(url)} is not an allowed URL`);
  return url;
}

/** @param {string} tagName @param {Record<string, unknown>} properties @param {any[]} [children] @returns {any} */
const element = (tagName, properties, children = []) => ({ type: "paragraph", data: { hName: tagName, hProperties: properties }, children });

/** @param {any[]} children */
const caption = (children) => (children.length > 0 ? [element("figcaption", {}, children)] : []);

/**
 * `> [!NOTE]` and the other four, with an optional title after the marker (Obsidian's form). A role=note div, as GitHub renders them,
 * so a screen reader announces it as a note; the title is text, not a heading, so it stays out of the table of contents.
 */
export function remarkCallouts() {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "blockquote", (node) => {
      const first = node.children[0];
      if (first?.type !== "paragraph") return;
      const lead = first.children[0];
      if (lead?.type !== "text") return;
      const match = CALLOUT_LINE.exec(lead.value);
      if (!match) return;
      const type = /** @type {string} */ (match[1]).toLowerCase();
      lead.value = lead.value.slice(match[0].length);
      if (lead.value === "") first.children.shift();
      // A soft break left at the front of the paragraph by the marker's own line.
      if (first.children[0]?.type === "break") first.children.shift();
      if (first.children.length === 0) node.children.shift();
      const title = (match[2] ?? "").trim() || type[0]?.toUpperCase() + type.slice(1);
      node.data = { ...node.data, hName: "div", hProperties: { className: ["callout", `callout-${type}`], role: "note" } };
      node.children.unshift(/** @type {any} */ (element("p", { className: ["callout-title"] }, [{ type: "text", value: title }])));
    });
  };
}

/**
 * `:kbd[Ctrl]`, `:abbr[HTML]{title="HyperText Markup Language"}`, `:mark[text]`, `:sub[2]` and `:sup[2]`: the inline elements raw HTML
 * would otherwise be needed for, and raw HTML is dropped. An abbreviation without its expansion is refused: the title is the point.
 *
 * @param {string} file
 */
export function remarkInlineMarks(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "textDirective", (node) => {
      if (!["kbd", "abbr", "mark", "sub", "sup"].includes(node.name)) return;
      if (node.children.length === 0) throw new ContentError(file, `${where(node, `:${node.name}`)} has no text`);
      /** @type {Record<string, string>} */
      const properties = {};
      if (node.name === "abbr") {
        const title = attrsOf(node).title;
        if (!title) throw new ContentError(file, `${where(node, ":abbr")} requires a title attribute, the expansion`);
        properties.title = title;
      }
      node.data = { ...node.data, hName: node.name, hProperties: properties };
    });
  };
}

/**
 * :::video and :::audio, with the caption as the directive's content. Video requires captions (WCAG 1.2.2) unless it is marked silent,
 * and a poster, which is what a reader sees before playing and whose size the renderer gives the player so nothing shifts; audio requires
 * a transcript (WCAG 1.2.1). A video preloads metadata and audio nothing, and neither autoplays. A media file written as an image is
 * refused here, before it becomes a broken <img>.
 *
 * An image with no alt text is refused too: a missing alt is a forgotten one far more often than a decorative one. `![""](x)`, the
 * empty alt written out as HTML writes it, marks an image the reader loses nothing without.
 *
 * @param {string} file
 */
export function remarkMedia(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type === "image" || node.type === "imageReference") {
        const url = node.type === "image" ? node.url : `[${node.label ?? node.identifier}]`;
        if (node.type === "image" && MEDIA_FILE.test(url)) {
          throw new ContentError(file, `${where(node, "an image")} links ${url}, a video or audio file. Write :::video or :::audio`);
        }
        const alt = (node.alt ?? "").trim();
        if (!alt) {
          throw new ContentError(file, `${where(node, "an image")} ${url} has no alt text. Say what it shows, or write ![""](…) if it is decorative`);
        }
        if (DECORATIVE_ALT.test(alt)) node.alt = "";
        return;
      }
      if ((node.type !== "containerDirective" && node.type !== "leafDirective") || !["video", "audio"].includes(node.name)) return;
      const name = `:::${node.name}`;
      const attrs = attrsOf(node);
      const src = urlAttribute(file, node, name, "src");
      const title = attrs.title;
      if (!title) throw new ContentError(file, `${where(node, name)} requires a title attribute, its accessible name`);
      if (node.type === "containerDirective") refuseHeading(file, node, ", which belongs outside the media's caption.");
      const children = /** @type {any[]} */ (node.type === "containerDirective" ? node.children : []);

      if (node.name === "video") {
        const captions = urlAttribute(file, node, name, "captions", !("silent" in attrs));
        const poster = urlAttribute(file, node, name, "poster");
        const track = captions
          ? [element("track", { kind: "captions", src: captions, srcLang: attrs.lang ?? "en", label: attrs.label ?? "English", default: true })]
          : [];
        node.data = { hName: "figure", hProperties: { className: ["media", "media-video", ...widthClass(file, node, name)] } };
        node.children = [
          element("video", { src, poster, controls: true, preload: "metadata", playsInline: true, ariaLabel: title }, track),
          ...caption(children),
        ];
        return;
      }

      const transcript = urlAttribute(file, node, name, "transcript");
      node.data = { hName: "figure", hProperties: { className: ["media", "media-audio"] } };
      node.children = [
        element("audio", { src, controls: true, preload: "none", ariaLabel: title }),
        element("p", { className: ["media-transcript"] }, [{ type: "link", url: transcript, children: [{ type: "text", value: `Transcript: ${title}` }] }]),
        ...caption(children),
      ];
    });
  };
}

/**
 * The services an embed may load, each a URL pattern and the player it becomes. YouTube is its no-cookie host and Vimeo's player is told
 * not to track. Only the id is taken from the author's URL, checked against a strict pattern, so nothing the author wrote reaches the
 * player URL unescaped.
 *
 * @type {Array<{ name: string, label: string, pattern: RegExp, player: (match: RegExpExecArray, url: string) => string }>}
 */
export const EMBED_PROVIDERS = [
  {
    name: "youtube",
    label: "Watch on YouTube",
    pattern: /^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/,
    player: (m) => `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1`,
  },
  {
    name: "vimeo",
    label: "Watch on Vimeo",
    pattern: /^https:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})(?:[/?#].*)?$/,
    player: (m) => `https://player.vimeo.com/video/${m[1]}?dnt=1&autoplay=1`,
  },
  {
    name: "spotify",
    label: "Listen on Spotify",
    pattern: /^https:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})(?:[?#].*)?$/,
    player: (m) => `https://open.spotify.com/embed/${m[1]}/${m[2]}`,
  },
  {
    name: "soundcloud",
    label: "Listen on SoundCloud",
    pattern: /^https:\/\/soundcloud\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/,
    player: (_m, url) => `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`,
  },
];

/**
 * `::embed[Title]{url="https://youtu.be/…" poster="/media/…"}`. It renders as a link to the original with the player URL beside it, so the
 * page makes no request to the service until a reader asks: without script the link opens the service, and render/enhance swaps it for
 * the player on a click. The link is a poster with a play button (the lite embed): the `poster`, a picture on the site's own origin,
 * never the service's thumbnail, which would tell the service who is reading; without one, the site's card. The title names the link and
 * the player's iframe, which WCAG requires, so the poster's alt is empty.
 *
 * @param {string} file
 */
export function remarkEmbeds(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if ((node.type !== "leafDirective" && node.type !== "containerDirective") || node.name !== "embed") return;
      const url = attrsOf(node).url ?? "";
      const title = (node.type === "leafDirective" ? textOf(node).trim() : "") || attrsOf(node).title;
      for (const provider of EMBED_PROVIDERS) {
        const match = provider.pattern.exec(url);
        if (!match) continue;
        if (!title) throw new ContentError(file, `${where(node, "::embed")} requires a title: ::embed[What it shows]{url="…"}`);
        const children = /** @type {any[]} */ (node.type === "containerDirective" ? node.children : []);
        const poster = urlAttribute(file, node, "::embed", "poster", false);
        node.data = {
          hName: "figure",
          hProperties: { className: ["embed", `embed-${provider.name}`, ...widthClass(file, node, "::embed")] },
        };
        node.children = [
          element("a", { className: ["embed-link"], href: url, dataEmbedSrc: provider.player(match, url), dataEmbedTitle: title }, [
            ...(poster ? [element("img", { className: ["embed-poster"], src: poster, alt: "" })] : []),
            element("span", { className: ["embed-play"], ariaHidden: "true" }),
            element("span", { className: ["embed-label"] }, [{ type: "text", value: `${provider.label}: ${title}` }]),
          ]),
          ...caption(children),
        ];
        return;
      }
      throw new ContentError(
        file,
        `${where(node, "::embed")} cannot embed ${JSON.stringify(url)}. Embeds come from ${EMBED_PROVIDERS.map((p) => p.name).join(", ")}; ` +
          "link anything else, or write ::bookmark for a link card",
      );
    });
  };
}

/**
 * :::gallery holds two to nine images (Ghost's limit), each with alt text; any other text in it is the caption.
 *
 * @param {string} file
 */
export function remarkGallery(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "gallery") return;
      refuseHeading(file, node, ", which belongs outside the gallery.");
      /** @type {any[]} */
      const images = [];
      /** @type {any[]} */
      const rest = [];
      for (const child of node.children) {
        if (child.type !== "paragraph") {
          rest.push(child);
          continue;
        }
        const own = child.children.filter((c) => c.type === "image");
        const text = child.children.filter((c) => c.type !== "image" && !(c.type === "text" && c.value.trim() === ""));
        images.push(...own);
        if (text.length > 0) rest.push({ ...child, children: text });
      }
      if (images.length < 2 || images.length > 9) {
        throw new ContentError(file, `${where(node, ":::gallery")} holds ${images.length} images; a gallery takes 2 to 9`);
      }
      for (const image of images) {
        if (!image.alt?.trim()) throw new ContentError(file, `${where(node, ":::gallery")} image ${image.url} requires alt text`);
      }
      node.data = { hName: "figure", hProperties: { className: ["gallery", ...widthClass(file, node, ":::gallery")] } };
      node.children = /** @type {any[]} */ ([
        element("ul", { className: ["gallery-grid"] }, images.map((image) => element("li", {}, [image]))),
        ...caption(rest.flatMap((c) => (c.type === "paragraph" ? c.children : [c])).map((c, i) => (i === 0 && c.type === "text" ? { ...c, value: c.value.trimStart() } : c))),
      ]);
    });
  };
}

/**
 * `::button[Label]{href="/join"}`, Ghost's button card and WordPress's buttons block: a link styled as a button, one per line.
 * `::bookmark[Title]{url="…" description="…"}`, a link card written out by the author (or by Carrel), so the page fetches nothing.
 *
 * @param {string} file
 */
export function remarkLinkBlocks(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "leafDirective", (node) => {
      if (node.name !== "button" && node.name !== "bookmark") return;
      const label = textOf(node).trim();
      if (!label) throw new ContentError(file, `${where(node, `::${node.name}`)} has no label: ::${node.name}[Label]{…}`);
      if (node.name === "button") {
        const href = attrsOf(node).href;
        if (!href) throw new ContentError(file, `${where(node, "::button")} requires an href attribute`);
        node.data = { hName: "p", hProperties: { className: ["button-row"] } };
        node.children = [{ type: "link", url: href, data: { hProperties: { className: ["button"] } }, children: [{ type: "text", value: label }] }];
        return;
      }
      const url = /** @type {string} */ (urlAttribute(file, node, "::bookmark", "url"));
      const description = attrsOf(node).description;
      /** @type {any[]} */
      const parts = [element("span", { className: ["bookmark-title"] }, [{ type: "text", value: label }])];
      if (description) parts.push(element("span", { className: ["bookmark-description"] }, [{ type: "text", value: description }]));
      const host = /^https?:\/\//.test(url) ? new URL(url).host.replace(/^www\./, "") : "";
      if (host) parts.push(element("span", { className: ["bookmark-host"] }, [{ type: "text", value: host }]));
      node.data = { hName: "figure", hProperties: { className: ["bookmark"] } };
      node.children = [{ type: "link", url, data: { hProperties: { className: ["bookmark-link"] } }, children: parts }];
    });
  };
}

/**
 * The Q: and A: lines of a :::faq block. An answer runs on over the lines after its A: until the next Q:.
 *
 * @param {string} content
 * @returns {Array<{ question: string, answer: string }>}
 */
export function faqPairs(content) {
  /** @type {Array<{ question: string, answer: string }>} */
  const pairs = [];
  /** @type {string | null} */
  let question = null;
  /** @type {string[]} */
  let answer = [];
  const flush = () => {
    if (question && answer.length > 0) pairs.push({ question: question.trim(), answer: answer.join(" ").trim() });
    question = null;
    answer = [];
  };
  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("Q:")) {
      flush();
      question = line.slice(2).trim();
    } else if (line.startsWith("A:")) answer = [line.slice(2).trim()];
    else if (line !== "" && answer.length > 0) answer.push(line);
  }
  flush();
  return pairs;
}

/**
 * :::faq, Q: and A: lines read from the block's source, shown as text, and returned as `faq` so a site's FAQPage JSON-LD says exactly
 * what the page says (Google's FAQ rules).
 *
 * @param {string} file
 * @param {string} body
 * @param {Array<{ question: string, answer: string }>} sink
 */
export function remarkFaq(file, body, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "containerDirective", (node) => {
      if (node.name !== "faq") return;
      const start = node.position?.start.offset ?? 0;
      const end = node.position?.end.offset ?? start;
      const lines = body.slice(start, end).split("\n");
      const pairs = faqPairs(lines.slice(1, lines.at(-1)?.trim() === ":::" ? -1 : undefined).join("\n"));
      if (pairs.length === 0) throw new ContentError(file, `${where(node, ":::faq")} holds no Q: and A: pair`);
      sink.push(...pairs);
      node.data = { hName: "dl", hProperties: { className: ["faq"] } };
      node.children = pairs.map(({ question, answer }) =>
        /** @type {any} */ (
          element("div", { className: ["faq-item"] }, [
            element("dt", {}, [{ type: "text", value: question }]),
            element("dd", {}, [{ type: "text", value: answer }]),
          ])
        ),
      );
    });
  };
}

// Not line-anchored: a post link sits inside a sentence, where remark-directive leaves `::name` as text.
const POSTLINK = /::postlink\[([^|\]]+)(?:\|([^\]]+))?\]/g;

/**
 * `::postlink[slug]` and `::postlink[slug|text]`: a link to another post by its slug, resolved by the site at render time, so a renamed
 * post's new address is written on the next render. An unknown slug stays visible as code. Every slug asked for is returned as
 * `postLinks`, which is the site's backlink index.
 *
 * @param {(slug: string) => Promise<{ url: string, title: string } | null>} resolve
 * @param {string[]} sink
 * @param {Array<{ question: string, answer: string }>} faq the :::faq pairs, whose answers are text: a post link in one becomes its words
 */
export function remarkPostLinks(resolve, sink, faq) {
  return async (/** @type {import("mdast").Root} */ tree) => {
    /** @type {Array<{ node: import("mdast").Text, parent: import("mdast").Parent }>} */
    const found = [];
    visit(tree, "text", (node, _index, parent) => {
      if (parent && node.value.includes("::postlink[")) found.push({ node, parent });
    });
    const slugs = [...new Set(found.flatMap(({ node }) => [...node.value.matchAll(POSTLINK)].map((m) => (m[1] ?? "").trim())))];
    sink.push(...slugs);
    const targets = new Map(await Promise.all(slugs.map(async (slug) => /** @type {const} */ ([slug, await resolve(slug)]))));
    for (const pair of faq) {
      pair.answer = pair.answer.replace(POSTLINK, (_m, slug, text) => text?.trim() || targets.get(slug.trim())?.title || slug.trim());
    }
    for (const { node, parent } of found) {
      /** @type {any[]} */
      const parts = [];
      let at = 0;
      for (const m of node.value.matchAll(POSTLINK)) {
        if (m.index > at) parts.push({ type: "text", value: node.value.slice(at, m.index) });
        const slug = (m[1] ?? "").trim();
        const text = m[2]?.trim();
        const target = targets.get(slug);
        parts.push(
          target
            ? { type: "link", url: target.url, children: [{ type: "text", value: text || target.title }] }
            : { type: "inlineCode", value: m[0] },
        );
        at = m.index + m[0].length;
      }
      if (at < node.value.length) parts.push({ type: "text", value: node.value.slice(at) });
      parent.children.splice(parent.children.indexOf(node), 1, ...parts);
    }
  };
}

const CODE_TITLE = /(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|(\S+))/;

/**
 * A fence's `title="app.ts"` (Expressive Code's frame title) wraps the block in a figure with the title as its caption, so the file name
 * is read before the code. The rest of the meta is left for the highlighter's line markers.
 */
export function remarkCodeFrames() {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "code", (node, index, parent) => {
      const match = CODE_TITLE.exec(node.meta ?? "");
      if (!match || !parent || index === undefined) return;
      const title = match[1] ?? match[2] ?? match[3] ?? "";
      parent.children[index] = /** @type {any} */ (
        element("figure", { className: ["code-frame"] }, [element("figcaption", { className: ["code-title"] }, [{ type: "text", value: title }]), node])
      );
    });
  };
}

/**
 * The body sits under the page's own h1, so an h1 in it moves every heading down a level, and a skipped level (an h2 then an h4) is
 * returned as a warning for the editor to show: a warning, not a refusal, so an old post with an odd outline still renders.
 *
 * @param {Array<{ line: number | null, message: string }>} sink
 */
export function remarkOutline(sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    /** @type {import("mdast").Heading[]} */
    const headings = [];
    visit(tree, (node) => {
      if (node.type === "heading") headings.push(node);
    });
    if (headings.some((h) => h.depth === 1)) {
      for (const heading of headings) heading.depth = /** @type {any} */ (Math.min(heading.depth + 1, 6));
    }
    let previous = 1;
    for (const heading of headings) {
      if (heading.depth > previous + 1) {
        sink.push({
          line: heading.position?.start?.line ?? null,
          message: `heading "${textOf(heading).trim()}" skips from h${previous} to h${heading.depth}`,
        });
      }
      previous = heading.depth;
    }
    sink.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  };
}

/** The directive names this module handles, added to the core's list the unknown-directive guard checks. */
export const BLOCK_DIRECTIVES = ["abbr", "audio", "bookmark", "button", "embed", "faq", "gallery", "kbd", "mark", "sub", "sup", "video"];
