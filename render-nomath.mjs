// The markdown pipeline: markdown in, a safe HTML fragment out, one renderer for every site that publishes Carrel's writing
// (carrel/design-markdown-pipeline.md). Runs in a Worker, so no node:fs.
//
// This module is the pipeline without math, and imports no KaTeX: a site with no math imports it as `render/nomath`, `$3,000` stays
// text, and KaTeX (about 1.6 MB raw) never enters its bundle. render.mjs is the same pipeline with KaTeX passed in.
//
// What the core does not hold: a site's layout, its frontmatter, its media rules, its code highlighting and its extra directives. The
// site injects those through `options` (media, highlight, packs), so nothing here imports site code and shiki is not bundled unless a
// site asks for it.
//
// Safe by construction, and the three options that keep it so are the ones a single edit could flip. Each is named at its use, and
// test/render-safe.test.mjs plants each one and sees the hostile corpus go red:
//   1. remark-rehype is used WITHOUT allowDangerousHtml, so raw HTML in the source is dropped before it becomes markup.
//   2. rehypeUrlProtocols runs LAST, so it sees every URL attribute (href, src, poster, srcset, action, ...) any plugin emits.
//   3. KaTeX runs with its default `trust` off, so \href{javascript:...} and \url do not become links (render.mjs).

import { toString as hastToString } from "hast-util-to-string";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import {
  BLOCK_DIRECTIVES,
  remarkCallouts,
  remarkCodeFrames,
  remarkFaq,
  remarkInlineMarks,
  remarkLinkBlocks,
  remarkOutline,
  remarkPostLinks,
} from "./render-blocks.mjs";
import { remarkEmbeds, remarkGallery, remarkMedia } from "./render-media.mjs";
import {
  CORE_DIRECTIVES,
  remarkDetails,
  remarkFigure,
  remarkNumericTextDirectives,
  remarkUnknownDirectives,
} from "./render-directives.mjs";
import { ContentError } from "./render-error.mjs";
import { rehypeLinks, remarkLinkDirectives } from "./render-links.mjs";
import { RENDER_VERSION } from "./render-version.mjs";
import { assertSafe, srcsetUrls } from "./render-safe.mjs";
import { isAllowedUrl, isCsvDownload, URL_ATTRIBUTES } from "./render-url.mjs";
import { readingMinutes } from "./text.mjs";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_DEPTH,
  encoder,
  DEFAULT_SCAN_LIMITS,
  assertScan,
  remarkLimitDepth,
} from "./render-limits.mjs";
import {
  rehypeEmptyHeaders,
  rehypeTableScroll,
  rehypeCodeRegions,
  rehypeTaskListLabels,
} from "./render-regions.mjs";
import { rehypeImageSources } from "./render-images.mjs";
import { rehypeCollectToc, rehypeUniqueSlug, rehypeCollectText } from "./render-collect.mjs";
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_DEPTH, DEFAULT_SCAN_LIMITS } from "./render-limits.mjs";

export { ContentError, RENDER_VERSION, isAllowedUrl };

/**
 * @typedef {import("./render-packs.mjs").RenderPack} RenderPack
 *
 * @typedef {object} MediaOptions What a site decides about its images; the core knows none of it.
 * @property {(raw: string) => string | null} [keyOf] The key a URL cites, or null when it is not media. Collected into mediaRefs.
 * @property {(src: string) => { srcSet?: string, sizes?: string, href?: string, sources?: Array<{ type: string, srcSet: string, media?: string }> } | null} [imageProps]
 *   Responsive attributes for an image, and the href of the link that wraps it (the unsized original). `sources` (each a MIME type, a
 *   srcset and an optional media query, AVIF first) wrap the image in a <picture>; site-runtime's ./image writes them, and its GIF
 *   sources under `(prefers-reduced-motion: reduce)` also give the animation a pause control. Null leaves the image as written.
 *
 * @typedef {object} ImageFacts What the site's resolver knows of an image: its size and placeholder, and the library's credit and license.
 * @property {number} width
 * @property {number} height
 * @property {string} [placeholder] a base64 data: URL shown while the image loads
 * @property {string} [credit] who made it, shown under the picture and written as the ImageObject's creditText
 * @property {string} [license] the terms: a URL is the ImageObject's license, words (CC BY 4.0) are shown beside the credit and written
 *   as its copyrightNotice
 *
 * @typedef {object} RenderedImage An image the body shows, with what an ImageObject (schema `imageObject`) and the image sitemap need;
 *   `src` as written, for the site to make absolute. A decorative image, a dark-theme twin and an embed's poster are left out.
 * @property {string} src
 * @property {string} alt
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [creditText]
 * @property {string} [copyrightNotice]
 * @property {string} [license]
 *
 * @typedef {object} RenderedVideo A video the body plays, for the page's `og:video` and VideoObject (schema `videoObject`).
 * @property {"file" | "embed"} kind a :::video file, or an ::embed player
 * @property {string} url the file, or the page on the service
 * @property {string} title
 * @property {string} [embedUrl] the player an embed loads
 * @property {string} [poster]
 * @property {string} [captions]
 * @property {number} [width] the poster's
 * @property {number} [height]
 *
 * @typedef {object} HighlightOptions Code highlighting, injected so the core does not bundle a grammar set.
 * @property {() => Promise<[unknown, ...unknown[]]>} plugin The rehype plugin and its arguments, as render-highlight.mjs builds them.
 *
 * @typedef {object} RenderOptions
 * @property {readonly RenderPack[]} [packs] Extra directives, in the order they run.
 * @property {MediaOptions} [media]
 * @property {HighlightOptions} [highlight] Without it a code block is plain <pre><code class="language-x">.
 * @property {number} [maxBytes] Refuse a source longer than this many UTF-8 bytes. Default 512 KB.
 * @property {number} [maxDepth] Refuse a source nested deeper than this. Default 100.
 * @property {Partial<typeof DEFAULT_SCAN_LIMITS>} [scanLimits] Most reference links (`][`), emphasis marks (`*`, `_`) and `[` outside fenced
 *   code. Defaults 2,000, 8,000 and 10,000: parsing them is quadratic, so raise one only for a page that needs it.
 * @property {(slug: string) => Promise<{ url: string, title: string } | null>} [postLink] Resolves `::postlink[slug]` to the post's
 *   current address and title. Without it `::postlink[…]` stays text.
 * @property {import("./render-links.mjs").LinkOptions} [links] The site's origin, the family's sites and the file sizes the link
 *   contract reads (render-links.mjs). Without it every kind but away and family is still written.
 * @property {import("./render-links.mjs").LinkIconOptions} [linkIcons] The store an away link's icon is kept in, fetched once from
 *   the host on a miss (render-link-icons.mjs). Without it nothing is fetched and an away link has no icon.
 * @property {{ taken: boolean } | false} [priority] The page's one fetchpriority=high. A page that renders several bodies (a cover's
 *   caption, a post and its notes) makes one `{ taken: false }` and passes it to each render, in page order, so only the page's first
 *   image takes it; `{ taken: true }` when the page's LCP image is outside the body, or `false`, gives every body image lazy loading.
 *   Without it each render's first image takes it.
 * @property {boolean} [smartPunctuation] Curly quotes, dashes and ellipses (SmartyPants, Astro's default). On unless false.
 * @property {boolean | { tags: ReadonlySet<string>, attributes: ReadonlySet<string> }} [assertSafe] Run the output scan on the result and
 *   throw when it finds an element or attribute outside the allowlist. Off by default; `true` uses the allowlist derived from the
 *   conformance corpus, an object supplies a site's own.
 */

/**
 * Runs at render time so every citation the renderer emits is indexed by construction. Must run BEFORE remarkFigure, which erases the
 * directive and would turn figure-directive into markdown-image.
 *
 * @param {unknown[]} sink
 * @param {(raw: string) => string | null} keyOf
 */
function remarkCollectMedia(sink, keyOf) {
  return (/** @type {import("mdast").Root} */ tree) => {
    // A definition an image reference uses (`![alt][ref]`) is an image's URL, not a link's.
    /** @type {Set<string>} */
    const imageIds = new Set();
    visit(tree, "imageReference", (node) => {
      imageIds.add(node.identifier);
    });
    /** @param {string | null | undefined} url @param {string} form @param {any} node */
    const add = (url, form, node) => {
      const key = keyOf(url ?? "");
      if (!key) return;
      sink.push({
        key,
        form,
        detail: node?.position?.start?.line ? `line ${node.position.start.line}` : null,
      });
    };

    visit(tree, (node) => {
      switch (node.type) {
        case "image":
          add(node.url, "markdown-image", node);
          break;
        case "link":
          add(node.url, "link", node);
          break;
        // A reference definition: the link that uses it carries no URL of its own.
        case "definition":
          add(node.url, imageIds.has(node.identifier) ? "markdown-image" : "link", node);
          break;
        case "leafDirective":
        case "containerDirective":
          if (node.name === "figure") {
            add(node.attributes?.src, "figure-directive", node);
            add(node.attributes?.dark, "figure-directive", node);
          }
          if (node.name === "video" || node.name === "audio" || node.name === "embed") {
            for (const key of ["src", "poster", "captions", "transcript"])
              add(node.attributes?.[key], "media-directive", node);
          }
          break;
        // Regex, not a parser, so every URL-carrying attribute is caught; over-detection only refuses a delete.
        case "html": {
          const text = String(node.value ?? "");
          for (const match of text.matchAll(/["'\s(]((?:https?:)?\/[^"'\s)>]+)/g)) {
            add(match[1], "html", node);
          }
          break;
        }
        default:
          break;
      }
    });
  };
}

/**
 * Renders as the original markdown so a blocked link visibly fails, as a text node so it is escaped. Runs LAST so it sees every href
 * and src any plugin emits (option 2 in the header).
 *
 * @param {string} file
 * @param {Array<{ file: string, tag: string, url: string }>} sink
 */
function rehypeUrlProtocols(file, sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      const isLink = node.tagName === "a";
      const isImage = node.tagName === "img";
      const properties = /** @type {Record<string, unknown>} */ (node.properties ?? {});

      if (isLink || isImage) {
        const attribute = isLink ? "href" : "src";
        const raw = properties[attribute];
        if (raw !== undefined && raw !== null) {
          const url = String(raw);
          if (
            !isAllowedUrl(url) &&
            !(isLink && properties.download !== undefined && isCsvDownload(url))
          ) {
            sink.push({ file, tag: node.tagName, url });

            const text = isLink
              ? `[${hastToString(node)}](${url})`
              : `![${String(properties.alt ?? "")}](${url})`;

            if (parent && typeof index === "number") {
              parent.children[index] = { type: "text", value: text };
            }
            return;
          }
        }
      }

      // Every other attribute a browser loads or navigates to: a plugin that wrote one is held to the same list. The attribute goes, the
      // element stays.
      for (const name of Object.keys(properties)) {
        if (!URL_ATTRIBUTE_NAMES.has(name.toLowerCase())) continue;
        if ((isLink && name === "href") || (isImage && name === "src")) continue;
        const raw = properties[name];
        if (raw === undefined || raw === null || raw === false || raw === true) continue;
        const value = Array.isArray(raw) ? raw.join(", ") : String(raw);
        const urls = name.toLowerCase() === "srcset" ? srcsetUrls(value) : [value];
        const bad = urls.find((url) => !isAllowedUrl(url));
        if (bad === undefined) continue;
        sink.push({ file, tag: node.tagName, url: bad });
        delete properties[name];
      }
    });
  };
}

/** Attributes that hold a URL the browser loads or navigates to, as hast names them and as a plugin may write them, lower-cased. */
const URL_ATTRIBUTE_NAMES = new Set([...URL_ATTRIBUTES, "srcset", "xlinkhref", "longdesc"]);

/**
 * @typedef {object} RenderInput
 * @property {string} file label used in error messages
 * @property {string} body markdown with any frontmatter already stripped
 * @property {(src: string) => Promise<ImageFacts | null>} resolveImage
 * @property {RenderOptions} [options]
 *
 * @typedef {object} MathPlugins What render.mjs passes in; without it there is no math syntax and `$` is text.
 * @property {any} parse remark-math
 * @property {(file: string, sink: { value: boolean }) => (tree: import("mdast").Root) => void} validate
 * @property {any} html rehype-katex
 * @property {object} options KATEX_OPTIONS
 */

/** @param {RenderInput} input */
export function render(input) {
  return renderWith(input, null);
}

/**
 * @param {RenderInput} input
 * @param {MathPlugins | null} math
 */
export async function renderWith({ file, body, resolveImage, options = {} }, math) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const size = encoder.encode(body).byteLength;
  if (size > maxBytes) {
    throw new ContentError(file, `source is ${size} bytes and the limit is ${maxBytes}`);
  }
  assertScan(file, body, maxDepth, { ...DEFAULT_SCAN_LIMITS, ...options.scanLimits });

  const packs = options.packs ?? [];
  const known = [
    ...CORE_DIRECTIVES,
    ...BLOCK_DIRECTIVES,
    ...packs.flatMap((pack) => pack.directives),
  ];
  const runs = packs.map((pack) =>
    pack.setup({ file, body, warn: (warning) => warnings.push(warning) }),
  );

  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<Promise<void>>} */
  const pending = [];
  /** @type {Array<{ key: string, form: string, detail: string | null }>} */
  const mediaRefs = [];
  // Collected, not thrown: one bad href must not fail the whole build; the preview shows it.
  /** @type {Array<{ file: string, tag: string, url: string }>} */
  const blockedUrls = [];
  const hasMath = { value: false };
  /** @type {string[]} */
  const postLinks = [];
  /** @type {Array<{ line: number | null, message: string }>} */
  const warnings = [];
  const reading = { words: 0, images: 0, excerpt: "" };
  const media = {
    images: /** @type {RenderedImage[]} */ ([]),
    videos: /** @type {RenderedVideo[]} */ ([]),
    warnings,
    after: /** @type {Array<() => void>} */ ([]),
  };
  const priority =
    options.priority === false ? { taken: true } : (options.priority ?? { taken: false });

  const keyOf = options.media?.keyOf ?? (() => null);
  // One lookup per src in a render: a resolver that reads D1 or R2 pays once for an image used twice.
  /** @type {Map<string, ReturnType<typeof resolveImage>>} */
  const sizes = new Map();
  const resolveOnce = (/** @type {string} */ src) => {
    if (!sizes.has(src)) sizes.set(src, resolveImage(src));
    return /** @type {ReturnType<typeof resolveImage>} */ (sizes.get(src));
  };
  const imageProps = options.media?.imageProps ?? (() => null);

  /** @type {any} */
  // singleTilde off: a lone tilde is prose (H~2~O, ~5 km), and the GFM spec makes single-tilde strikethrough optional.
  const processor = unified().use(remarkParse).use(remarkGfm, { singleTilde: false });
  if (math) processor.use(math.parse);
  processor
    .use(remarkDirective)
    .use(remarkLimitDepth, file, maxDepth)
    // Before any directive is interpreted, so prose such as 12:30 is text again.
    .use(remarkNumericTextDirectives, body)
    .use(remarkUnknownDirectives, file, known);
  if (math) processor.use(math.validate, file, hasMath);
  processor
    // Before remarkFigure, which erases the directive the media form is read from.
    .use(remarkCollectMedia, mediaRefs, keyOf)
    .use(remarkFigure, file)
    .use(remarkDetails, file)
    .use(remarkCallouts)
    .use(remarkInlineMarks, file)
    .use(remarkLinkDirectives, file)
    .use(remarkMedia, file)
    .use(remarkEmbeds, file)
    .use(remarkGallery, file)
    .use(remarkLinkBlocks, file)
    // Reads the block's source, so before anything rewrites its text.
    .use(remarkFaq, file, body)
    .use(remarkCodeFrames)
    .use(remarkOutline, warnings);
  if (options.postLink) processor.use(remarkPostLinks, options.postLink, postLinks);
  // After every block that reads text as written: a post link's slug and a FAQ's source must not gain curly quotes. Old-school dashes,
  // as in TeX: -- is an en dash, --- an em dash.
  if (options.smartPunctuation !== false) processor.use(remarkSmartypants, { dashes: "oldschool" });

  for (const run of runs) {
    for (const [plugin, ...args] of run.remark) processor.use(plugin, ...args);
  }

  // Option 1 in the header: no allowDangerousHtml, so raw HTML in the source never becomes markup.
  processor
    .use(remarkRehype)
    .use(rehypeEmptyHeaders)
    .use(rehypeTableScroll)
    .use(rehypeTaskListLabels);

  for (const run of runs) {
    for (const [plugin, ...args] of run.rehype) processor.use(plugin, ...args);
  }

  processor
    .use(rehypeUniqueSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeCollectText, reading)
    .use(rehypeAutolinkHeadings, {
      // Keyboard-reachable on purpose; the aria-label is the name, because # is not one. It carries the heading, so a links list is
      // not a column of identical "Link to this section" entries. Called before the # is appended, so the text is the heading's alone.
      properties: (/** @type {any} */ heading) => ({
        className: ["heading-anchor"],
        "aria-label": `Link to section: ${hastToString(heading).trim()}`,
      }),
      behavior: "append",
      content: { type: "text", value: "#" },
    });
  // After rehypeSlug, rehypeCollectToc and the autolinks: they read heading text, and after KaTeX that text is the expression twice
  // over (MathML plus HTML), ruining ids and the toc. Option 3 in the header: KATEX_OPTIONS leaves `trust` off.
  if (math) processor.use(math.html, math.options);
  processor.use(rehypeImageSources, file, resolveOnce, pending, imageProps, priority, media);
  // After the image links exist, which it tells from an author's link by their class.
  processor.use(rehypeLinks, options.links ?? {}, options.linkIcons, pending);

  if (options.highlight) {
    const [plugin, ...args] = await options.highlight.plugin();
    processor.use(plugin, ...args);
  }

  processor.use(rehypeCodeRegions);

  // LAST (option 2 in the header), so it sees every URL attribute any plugin emits (href, src, poster, srcset, action, formaction, data, cite, xlink:href).
  processor.use(rehypeUrlProtocols, file, blockedUrls).use(rehypeStringify);

  /** @type {string} */
  let html;
  try {
    const tree = processor.parse(body);
    const transformed = await processor.run(tree);
    await Promise.all(pending);
    for (const step of media.after) step();
    html = processor.stringify(transformed);
  } catch (error) {
    // A nesting the scan does not foresee still ends as a content error, not a raw stack overflow.
    if (error instanceof RangeError)
      throw new ContentError(file, "markdown is too deeply nested to render");
    throw error;
  }

  if (options.assertSafe) {
    assertSafe(html, options.assertSafe === true ? undefined : options.assertSafe);
  }

  /** @type {Record<string, unknown>} */
  const extras = Object.assign({}, ...runs.map((run) => run.result?.() ?? {}));

  return {
    // A pack may add fields and may fill diagrams; it may not replace the fields below, which are the contract.
    diagrams: /** @type {Array<{ key: string, source: string }>} */ ([]),
    ...extras,
    // A fragment: no <html>, no layout. The site wraps it in its own.
    html,
    toc,
    hasMath: hasMath.value,
    mediaRefs,
    images: media.images,
    videos: media.videos,
    postLinks,
    words: reading.words,
    readingMinutes: readingMinutes(reading.words, reading.images),
    excerpt: reading.excerpt,
    // Facts about one render for the editor to show, like blockedUrls.
    warnings,
    // Not a durable field: a fact about one render, and hashing it would churn on a blocked URL.
    blockedUrls,
    renderVersion: RENDER_VERSION,
  };
}
