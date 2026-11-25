// The media blocks: images, video and audio, embeds and galleries, each refusing what it cannot render well rather than guessing.

import { visit } from "unist-util-visit";

import { ContentError } from "./render-error.mjs";
import { BLUESKY_HANDLE, EMBED_PROVIDERS } from "./render-embeds.mjs";
import { attrsOf, caption, element, textOf, urlAttribute, where } from "./render-blocks.mjs";
import { refuseHeading, widthClass } from "./render-directives.mjs";

/** `![""](x)`, straight or curly quotes: the author's word that the image is decorative. */
const DECORATIVE_ALT = /^(?:""|\u201c\u201d)$/;

const MEDIA_FILE = /\.(?:mp4|m4v|mov|webm|ogv|mp3|m4a|aac|oga|ogg|wav|flac)(?:[?#]|$)/i;

/**
 * :::video and :::audio, with the caption as the directive's content. Video requires captions (WCAG 1.2.2) unless it is marked silent, in
 * which case the content must describe it (WCAG 1.2.1: video-only needs a text alternative), and a poster, which is what a reader sees before playing and whose size the renderer gives the player so nothing shifts; audio requires
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
          throw new ContentError(
            file,
            `${where(node, "an image")} links ${url}, a video or audio file. Write :::video or :::audio`,
          );
        }
        const alt = (node.alt ?? "").trim();
        if (!alt) {
          throw new ContentError(
            file,
            `${where(node, "an image")} ${url} has no alt text. Say what it shows, or write ![""](…) if it is decorative`,
          );
        }
        if (DECORATIVE_ALT.test(alt)) node.alt = "";
        return;
      }
      if (
        (node.type !== "containerDirective" && node.type !== "leafDirective") ||
        !["video", "audio"].includes(node.name)
      )
        return;
      const name = `:::${node.name}`;
      const attrs = attrsOf(node);
      const src = urlAttribute(file, node, name, "src");
      const title = attrs.title?.trim();
      if (!title)
        throw new ContentError(
          file,
          `${where(node, name)} requires a title attribute, its accessible name`,
        );
      if (node.type === "containerDirective")
        refuseHeading(file, node, ", which belongs outside the media's caption.");
      const children = /** @type {any[]} */ (
        node.type === "containerDirective" ? node.children : []
      );

      if (node.name === "video") {
        const captions = urlAttribute(file, node, name, "captions", !("silent" in attrs));
        const poster = urlAttribute(file, node, name, "poster");
        // A silent video has no audio to caption, but its pictures still need a text alternative (WCAG 1.2.1): the content is it.
        if ("silent" in attrs && !textOf({ children }).trim())
          throw new ContentError(
            file,
            `${where(node, name)} is silent, so it needs a description as its content (:::video{…} then text, then :::), the text alternative to its pictures`,
          );
        const track = captions
          ? [
              element("track", {
                kind: "captions",
                src: captions,
                srcLang: attrs.lang ?? "en",
                label: attrs.label ?? "English",
                default: true,
              }),
            ]
          : [];
        node.data = {
          hName: "figure",
          hProperties: { className: ["media", "media-video", ...widthClass(file, node, name)] },
        };
        node.children = [
          element(
            "video",
            {
              src,
              poster,
              controls: true,
              preload: "metadata",
              playsInline: true,
              ariaLabel: title,
            },
            track,
          ),
          ...caption(children),
        ];
        return;
      }

      const transcript = urlAttribute(file, node, name, "transcript");
      node.data = { hName: "figure", hProperties: { className: ["media", "media-audio"] } };
      node.children = [
        element("audio", { src, controls: true, preload: "none", ariaLabel: title }),
        element("p", { className: ["media-transcript"] }, [
          {
            type: "link",
            url: transcript,
            children: [{ type: "text", value: `Transcript: ${title}` }],
          },
        ]),
        ...caption(children),
      ];
    });
  };
}

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
      if (
        (node.type !== "leafDirective" && node.type !== "containerDirective") ||
        node.name !== "embed"
      )
        return;
      const url = attrsOf(node).url ?? "";
      const title =
        (node.type === "leafDirective" ? textOf(node).trim() : "") || attrsOf(node).title?.trim();
      for (const provider of EMBED_PROVIDERS) {
        const match = provider.pattern.exec(url);
        if (!match) continue;
        if (!title)
          throw new ContentError(
            file,
            `${where(node, "::embed")} requires a title: ::embed[What it shows]{url="…"}`,
          );
        const children = /** @type {any[]} */ (
          node.type === "containerDirective" ? node.children : []
        );
        const poster = urlAttribute(file, node, "::embed", "poster", false);
        node.data = {
          hName: "figure",
          hProperties: {
            className: ["embed", `embed-${provider.name}`, ...widthClass(file, node, "::embed")],
          },
        };
        node.children = [
          element(
            "a",
            {
              className: ["embed-link"],
              href: url,
              dataEmbedSrc: provider.player(match, url),
              dataEmbedTitle: title,
            },
            [
              ...(poster
                ? [element("img", { className: ["embed-poster"], src: poster, alt: "" })]
                : []),
              ...(provider.kind === "video" || provider.kind === "audio"
                ? [element("span", { className: ["embed-play"], ariaHidden: "true" })]
                : []),
              element("span", { className: ["embed-label"] }, [
                { type: "text", value: `${provider.label}: ${title}` },
              ]),
            ],
          ),
          ...caption(children),
        ];
        return;
      }
      if (BLUESKY_HANDLE.test(url)) {
        throw new ContentError(
          file,
          `${where(node, "::embed")} needs the Bluesky post's DID URL: on the post choose Embed post and copy the did:plc: part, as in https://bsky.app/profile/did:plc:…/post/…`,
        );
      }
      throw new ContentError(
        file,
        `${where(node, "::embed")} cannot embed ${JSON.stringify(url)}. Embeds come from ${[...new Set(EMBED_PROVIDERS.map((p) => p.name))].join(", ")}; ` +
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
        const text = child.children.filter(
          (c) => c.type !== "image" && !(c.type === "text" && c.value.trim() === ""),
        );
        images.push(...own);
        if (text.length > 0) rest.push({ ...child, children: text });
      }
      if (images.length < 2 || images.length > 9) {
        throw new ContentError(
          file,
          `${where(node, ":::gallery")} holds ${images.length} images; a gallery takes 2 to 9`,
        );
      }
      for (const image of images) {
        if (!image.alt?.trim())
          throw new ContentError(
            file,
            `${where(node, ":::gallery")} image ${image.url} requires alt text`,
          );
      }
      node.data = {
        hName: "figure",
        hProperties: { className: ["gallery", ...widthClass(file, node, ":::gallery")] },
      };
      node.children = /** @type {any[]} */ ([
        element(
          "ul",
          { className: ["gallery-grid"] },
          images.map((image) => element("li", {}, [image])),
        ),
        ...caption(
          rest
            .flatMap((c) => (c.type === "paragraph" ? c.children : [c]))
            .map((c, i) =>
              i === 0 && c.type === "text" ? { ...c, value: c.value.trimStart() } : c,
            ),
        ),
      ]);
    });
  };
}
