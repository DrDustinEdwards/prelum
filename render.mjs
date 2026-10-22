// The markdown pipeline: markdown in, a safe HTML fragment out. It is dustinedwards-info's renderer (app/lib/content/pipeline.mjs) moved
// here, so every site that publishes Carrel's writing renders it the same way (carrel/design-markdown-pipeline.md). Runs in a Worker, so
// no node:fs.
//
// What the core does not hold: a site's layout, its frontmatter, its media rules, its code highlighting and its extra directives. The
// site injects those through `options` (media, highlight, packs), so nothing here imports site code and shiki is not bundled unless a
// site asks for it.
//
// Safe by construction, and the three options that keep it so are the ones a single edit could flip. Each is named at its use, and
// test/render-safe.test.mjs plants each one and sees the hostile corpus go red:
//   1. remark-rehype is used WITHOUT allowDangerousHtml, so raw HTML in the source is dropped before it becomes markup.
//   2. rehypeUrlProtocols runs LAST, so it sees every href and src any plugin emits.
//   3. KaTeX runs with its default `trust` off, so \href{javascript:...} and \url do not become links.

import { toString as hastToString } from "hast-util-to-string";
import katex from "katex";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

import {
  CORE_DIRECTIVES,
  remarkDetails,
  remarkFigure,
  remarkNumericTextDirectives,
  remarkUnknownDirectives,
} from "./render-directives.mjs";
import { ContentError, errorMessage } from "./render-error.mjs";
import { KATEX_OPTIONS } from "./render-math.mjs";
import { LQIP_STYLE, assertSafe, srcsetUrls } from "./render-safe.mjs";
import { isAllowedUrl } from "./render-url.mjs";

export { ContentError, isAllowedUrl };

/**
 * Bumped whenever the output changes for the same input. A site stores it beside its rendered HTML and re-renders on a mismatch; Carrel's
 * health check reads it from meta.capabilities.render. test/render-golden.test.mjs fails when the output moves and this does not.
 */
export const RENDER_VERSION = "2";

/** A source over this is refused before it is parsed: a 200,000-character bracket run took 2.8 s, which a Worker cannot be sent. */
export const DEFAULT_MAX_BYTES = 512 * 1024;

/** The deepest nesting of markdown nodes allowed (lists in quotes in lists), so a hostile source cannot recurse the stack. */
export const DEFAULT_MAX_DEPTH = 100;

const encoder = new TextEncoder();

/**
 * @typedef {import("./render-packs.mjs").RenderPack} RenderPack
 *
 * @typedef {object} MediaOptions What a site decides about its images; the core knows none of it.
 * @property {(raw: string) => string | null} [keyOf] The key a URL cites, or null when it is not media. Collected into mediaRefs.
 * @property {(src: string) => { srcSet?: string, sizes?: string, href?: string } | null} [imageProps] Responsive attributes for an
 *   image, and the href of the link that wraps it (the unsized original). Null leaves the image as written.
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
 * @property {boolean | { tags: ReadonlySet<string>, attributes: ReadonlySet<string> }} [assertSafe] Run the output scan on the result and
 *   throw when it finds an element or attribute outside the allowlist. Off by default; `true` uses the allowlist derived from the
 *   conformance corpus, an object supplies a site's own.
 */

/**
 * @param {import("mdast").Root} tree
 * @param {string} file
 * @param {number} maxDepth
 */
function assertDepth(tree, file, maxDepth) {
  /** @type {Array<[any, number]>} */
  const stack = [[tree, 1]];
  while (stack.length > 0) {
    const [node, depth] = /** @type {[any, number]} */ (stack.pop());
    if (depth > maxDepth) {
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `markdown is nested more than ${maxDepth} levels deep${line ? ` at line ${line} of the body` : ""}`,
      );
    }
    for (const child of node.children ?? []) stack.push([child, depth + 1]);
  }
}

/**
 * @param {string} file
 * @param {number} maxDepth
 */
function remarkLimitDepth(file, maxDepth) {
  return (/** @type {import("mdast").Root} */ tree) => assertDepth(tree, file, maxDepth);
}

/**
 * Runs at render time so every citation the renderer emits is indexed by construction. Must run BEFORE remarkFigure, which erases the
 * directive and would turn figure-directive into markdown-image.
 *
 * @param {any[]} sink
 * @param {(raw: string) => string | null} keyOf
 */
function remarkCollectMedia(sink, keyOf) {
  return (/** @type {import("mdast").Root} */ tree) => {
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
          add(node.url, "link", node);
          break;
        case "containerDirective":
          if (node.name === "figure") add(node.attributes?.src, "figure-directive", node);
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
 * The AST-side owner of hasMath; a site compares it with htmlHasMath over its corpus.
 *
 * @param {string} file
 * @param {{ value: boolean }} sink set to true when the post carries any math
 */
function remarkMathValidate(file, sink) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "inlineMath" && node.type !== "math") return;
      sink.value = true;

      const expression = String(/** @type {any} */ (node).value ?? "");
      const line = node.position?.start?.line;
      try {
        // The same KATEX_OPTIONS rehype-katex gets, so passing here proves its catch branch unreachable.
        katex.renderToString(expression, {
          ...KATEX_OPTIONS,
          displayMode: node.type === "math",
          throwOnError: true,
        });
      } catch (error) {
        const detail = errorMessage(error);
        // A line of the BODY: the tree is parsed without frontmatter, and an editor preview has no file.
        throw new ContentError(
          file,
          `KaTeX cannot render ${node.type === "math" ? "the display" : "the inline"} ` +
            `expression${line ? ` on line ${line} of the body` : ""}: ${detail}. ` +
            `The expression is: ${expression.trim()}`,
        );
      }
    });
  };
}

/**
 * A wrapper, not display: block on the table, which can strip the table role from a screen reader. tabindex so keyboard users can
 * scroll it; no role=region, because an unnamed region is noise.
 */
function rehypeTableScroll() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "table" || !parent || index === undefined) return;
      if (parent.type === "element" && parent.properties?.className?.includes?.("table-scroll")) return;
      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"], tabIndex: 0 },
        children: [node],
      };
    });
  };
}

/**
 * remark-gfm emits a task-list checkbox with no name, which axe fails as critical. A <label> wraps the checkbox and the item's first
 * line, the inline content after it up to the first block (a nested list, a paragraph, a table). The name is then what the reader
 * sees once rendered (math, links, an image's alt), read once, and a loose item's later paragraphs stay out of it.
 */
const BLOCK_TAGS = new Set(["blockquote", "details", "div", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "ol", "p", "pre", "table", "ul"]);

function rehypeTaskListLabels() {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (item) => {
      if (item.tagName !== "li" || !item.properties?.className?.includes?.("task-list-item")) return;
      // The checkbox is first in the item, or first in its paragraph when the list is loose.
      const first = item.children.find((child) => child.type === "element");
      const line = first?.tagName === "p" ? first : item;
      const at = line.children.findIndex((child) => child.type === "element");
      const checkbox = line.children[at];
      if (checkbox?.type !== "element" || checkbox.tagName !== "input" || checkbox.properties?.type !== "checkbox") return;
      let end = at + 1;
      while (end < line.children.length) {
        const child = line.children[end];
        if (child.type === "element" && BLOCK_TAGS.has(child.tagName)) break;
        end += 1;
      }
      // Trailing whitespace before a nested list stays outside the label.
      while (end > at + 1) {
        const last = line.children[end - 1];
        if (last.type !== "text" || last.value.trim() !== "") break;
        end -= 1;
      }
      const label = { type: "element", tagName: "label", properties: {}, children: line.children.slice(at, end) };
      line.children.splice(at, end - at, /** @type {import("hast").Element} */ (label));
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
      if (!isLink && !isImage) return;

      const attribute = isLink ? "href" : "src";
      const raw = node.properties?.[attribute];
      if (raw === undefined || raw === null) return;

      const url = String(raw);
      if (isAllowedUrl(url)) return;

      sink.push({ file, tag: node.tagName, url });

      const text = isLink
        ? `[${textOf(node)}](${url})`
        : `![${String(node.properties?.alt ?? "")}](${url})`;

      if (parent && typeof index === "number") {
        parent.children[index] = { type: "text", value: text };
      }
    });
  };
}

/**
 * @param {import("hast").Nodes} node
 */
function textOf(node) {
  let out = "";
  visit(node, "text", (child) => {
    out += child.value;
  });
  return out;
}

/**
 * The anchor and srcset come from one decision in one visitor so they cannot disagree about a storage tier. The first image is eager
 * with fetchpriority=high: it is usually the LCP. The site decides, through media.imageProps, which images are responsive; an image it
 * returns null for keeps the attributes the resolver gives it and nothing more.
 *
 * @param {string} file
 * @param {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>} resolveImage
 * @param {Array<Promise<void>>} pending
 * @param {(src: string) => { srcSet?: string, sizes?: string, href?: string } | null} imageProps
 */
function rehypeImageSources(file, resolveImage, pending, imageProps) {
  let seen = 0;
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "img") return;
      // A diagram's asset is rendered by a later build step and may not exist yet. Checked by class, not plugin order, so moving this
      // plugin cannot re-enable it.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("diagram-image")) return;
      const src = String(node.properties?.src ?? "");
      // Left for rehypeUrlProtocols to show as text: no wrapper link, and the site's resolver is never handed a hostile URL.
      if (!isAllowedUrl(src)) return;

      const props = imageProps(src);
      // srcset and the placeholder are written after rehypeUrlProtocols has run, so they are checked here: a candidate URL outside the
      // policy drops the srcset, and a placeholder that is not the base64 form drops the placeholder.
      const responsive =
        props?.srcSet && srcsetUrls(props.srcSet).every(isAllowedUrl) ? { srcSet: props.srcSet, sizes: props.sizes } : {};

      // Links to the unsized original, which srcset never serves. Diagrams are excluded: an anchor around the display: none half would
      // be a focusable link with no name. An author's own link wins.
      const wrappable =
        src.length > 0 &&
        parent &&
        typeof index === "number" &&
        parent.children[index] === node &&
        !(parent.type === "element" && parent.tagName === "a");
      if (wrappable) {
        parent.children[index] = {
          type: "element",
          tagName: "a",
          properties: { className: ["image-link"], href: props?.href ?? src },
          children: [node],
        };
      }

      // Counted after every exclusion, so the first image that gets attributes gets the eager pair.
      seen += 1;
      const first = seen === 1;

      pending.push(
        resolveImage(src).then(({ width, height, placeholder }) => {
          const lqip = placeholder ? `background-image:url("${placeholder}")` : "";
          node.properties = {
            ...node.properties,
            ...responsive,
            width,
            height,
            loading: first ? "eager" : "lazy",
            decoding: "async",
            // fetchpriority=high is a budget: several images marked high is the same as none.
            ...(first ? { fetchpriority: "high" } : {}),
            // The inline style carries only the per-image URL.
            ...(LQIP_STYLE.test(lqip)
              ? {
                  className: [
                    ...(Array.isArray(node.properties?.className) ? node.properties.className : []),
                    "has-lqip",
                  ],
                  // Only the form render-safe.mjs allows: base64 holds no quote, parenthesis or space.
                  style: lqip,
                }
              : {}),
          };
        }),
      );
    });
  };
}

/**
 * @param {Array<{ depth: number, id: string, text: string }>} sink
 */
function rehypeCollectToc(sink) {
  return (/** @type {import("hast").Root} */ tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "h2" && node.tagName !== "h3") return;
      const id = String(node.properties?.id ?? "");
      if (!id) return;
      // remark-gfm emits a visually hidden "Footnotes" heading to label its section. It is not part of the outline a reader navigates.
      const classes = node.properties?.className ?? [];
      if (Array.isArray(classes) && classes.includes("sr-only")) return;
      sink.push({
        depth: node.tagName === "h2" ? 2 : 3,
        id,
        text: hastToString(node).replace(/#$/, "").trim(),
      });
    });
  };
}

/**
 * @param {object} input
 * @param {string} input.file label used in error messages
 * @param {string} input.body markdown with any frontmatter already stripped
 * @param {(src: string) => Promise<{ width: number, height: number, placeholder?: string }>} input.resolveImage
 * @param {RenderOptions} [input.options]
 */
export async function render({ file, body, resolveImage, options = {} }) {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const size = encoder.encode(body).byteLength;
  if (size > maxBytes) {
    throw new ContentError(file, `source is ${size} bytes and the limit is ${maxBytes}`);
  }

  const packs = options.packs ?? [];
  const known = [...CORE_DIRECTIVES, ...packs.flatMap((pack) => pack.directives)];
  const runs = packs.map((pack) => pack.setup({ file, body }));

  /** @type {Array<{ depth: number, id: string, text: string }>} */
  const toc = [];
  /** @type {Array<Promise<void>>} */
  const pending = [];
  /** @type {Array<{ key: string, form: string, detail: string | null }>} */
  const mediaRefs = [];
  // Collected, not thrown: one bad href must not fail the whole build; the preview shows it.
  /** @type {Array<{ file: string, tag: string, url: string }>} */
  const blockedUrls = [];
  const math = { value: false };

  const keyOf = options.media?.keyOf ?? (() => null);
  const imageProps = options.media?.imageProps ?? (() => null);

  /** @type {any} */
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkDirective)
    .use(remarkLimitDepth, file, maxDepth)
    // Before any directive is interpreted, so prose such as 12:30 is text again.
    .use(remarkNumericTextDirectives, body)
    .use(remarkUnknownDirectives, file, known)
    .use(remarkMathValidate, file, math)
    // Before remarkFigure, which erases the directive the media form is read from.
    .use(remarkCollectMedia, mediaRefs, keyOf)
    .use(remarkFigure, file)
    .use(remarkDetails, file);

  for (const run of runs) {
    for (const [plugin, ...args] of run.remark) processor.use(plugin, ...args);
  }

  // Option 1 in the header: no allowDangerousHtml, so raw HTML in the source never becomes markup.
  processor.use(remarkRehype).use(rehypeTableScroll).use(rehypeTaskListLabels);

  for (const run of runs) {
    for (const [plugin, ...args] of run.rehype) processor.use(plugin, ...args);
  }

  processor
    .use(rehypeSlug)
    .use(rehypeCollectToc, toc)
    .use(rehypeAutolinkHeadings, {
      // Keyboard-reachable on purpose; the aria-label is the name, because # is not one. It carries the heading, so a links list is
      // not a column of identical "Link to this section" entries. Called before the # is appended, so the text is the heading's alone.
      properties: (/** @type {any} */ heading) => ({
        className: ["heading-anchor"],
        "aria-label": `Link to section: ${hastToString(heading).trim()}`,
      }),
      behavior: "append",
      content: { type: "text", value: "#" },
    })
    // After rehypeSlug, rehypeCollectToc and the autolinks: they read heading text, and after KaTeX that text is the expression twice
    // over (MathML plus HTML), ruining ids and the toc. Option 3 in the header: KATEX_OPTIONS leaves `trust` off.
    .use(rehypeKatex, KATEX_OPTIONS)
    .use(rehypeImageSources, file, resolveImage, pending, imageProps);

  if (options.highlight) {
    const [plugin, ...args] = await options.highlight.plugin();
    processor.use(plugin, ...args);
  }

  // LAST (option 2 in the header), so it sees every href and src any plugin emits.
  processor.use(rehypeUrlProtocols, file, blockedUrls).use(rehypeStringify);

  const tree = processor.parse(body);
  const transformed = await processor.run(tree);
  await Promise.all(pending);
  const html = processor.stringify(transformed);

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
    hasMath: math.value,
    mediaRefs,
    // Not a durable field: a fact about one render, and hashing it would churn on a blocked URL.
    blockedUrls,
    renderVersion: RENDER_VERSION,
  };
}
