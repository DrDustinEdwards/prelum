// The image pass: responsive sources, the pause control for an animation, placeholders and the credit a library image carries.

import { toString as hastToString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

import { EMBED_PROVIDERS } from "./render-embeds.mjs";
import { LQIP_STYLE, srcsetUrls } from "./render-safe.mjs";
import { isAllowedUrl } from "./render-url.mjs";

/**
 * @typedef {import("./render-nomath.mjs").ImageFacts} ImageFacts
 * @typedef {import("./render-nomath.mjs").MediaOptions} MediaOptions
 * @typedef {import("./render-nomath.mjs").RenderedImage} RenderedImage
 * @typedef {import("./render-nomath.mjs").RenderedVideo} RenderedVideo
 */
/** Under this media query a site's sources are an animation's first frame (site-runtime's ./image writes them for a GIF). */
const REDUCED_MOTION = /prefers-reduced-motion:\s*reduce/;

/** A source's `media`: a media query, nothing that could close the attribute or reach a URL. */
const MEDIA_QUERY = /^[a-z0-9\s():,.-]+$/i;

/** @param {string} tagName @param {Record<string, unknown>} properties @param {any[]} [children] @returns {import("hast").Element} */
const el = (tagName, properties, children = []) => ({
  type: "element",
  tagName,
  properties: /** @type {any} */ (properties),
  children,
});

/** @param {any} node @param {string} name */
const hasClass = (node, name) => [node?.properties?.className ?? []].flat().includes(name);

/**
 * The resolver's credit and license as the page shows them, and as an ImageObject takes them: a license that is a URL is Google's
 * `license`, one that is words (CC BY 4.0, a copyright line) is the notice, shown beside the credit.
 *
 * @param {ImageFacts | null} facts
 */
function rightsOf(facts) {
  const credit = facts?.credit?.trim() || undefined;
  const license = facts?.license?.trim() || undefined;
  const licenseUrl =
    license && /^https?:\/\//.test(license) && isAllowedUrl(license) ? license : undefined;
  const notice = license && !licenseUrl ? license : undefined;
  return { credit, licenseUrl, notice, shown: [credit, notice].filter(Boolean).join(" · ") };
}

/** The credits this pass added from the media library, so a gallery adds each picture's once and an author's own wins. */
const libraryCredits = new WeakSet();

/**
 * The library's credit, shown under the picture: in its figure's caption unless the author wrote a credit there, else the paragraph that
 * holds only the picture becomes a figure with it as the caption. A picture inside a sentence shows none (its rights still reach the
 * page's ImageObject).
 *
 * @param {import("hast").Element} shown the outermost element written for the image
 * @param {Map<any, any>} parents
 * @param {string} text
 */
function showCredit(shown, parents, text) {
  let box = parents.get(shown);
  while (box && box.type === "element" && box.tagName !== "figure" && box.tagName !== "p")
    box = parents.get(box);
  if (!box || box.type !== "element") return;
  if (box.tagName === "p") {
    const own = box.children.filter(
      (/** @type {any} */ c) => !(c.type === "text" && c.value.trim() === ""),
    );
    if (own.length !== 1 || own[0] !== shown) return;
    box.tagName = "figure";
    box.properties = { className: ["image-figure"] };
  }
  const credit = el("span", { className: ["figure-credit"] }, [{ type: "text", value: text }]);
  let caption = box.children.find(
    (/** @type {any} */ c) => c.type === "element" && c.tagName === "figcaption",
  );
  if (!caption) {
    caption = el("figcaption", {});
    box.children.push(caption);
  }
  /** @type {any[]} */
  const credits = [];
  visit(caption, "element", (c) => {
    if (hasClass(c, "figure-credit")) credits.push(c);
  });
  // The author's credit wins; a gallery lists each picture's credit once.
  if (credits.length > 0 && !credits.some((c) => libraryCredits.has(c))) return;
  if (credits.some((c) => hastToString(c) === text)) return;
  libraryCredits.add(credit);
  caption.children.push(
    ...(caption.children.length > 0 ? [{ type: "text", value: " " }] : []),
    credit,
  );
}

/**
 * An animation with a still for reduced motion also gets a control that stops it for everyone (WCAG 2.2.2): a checkbox, so it works
 * without script, and the still hidden by an inline style, so a page without the stylesheet shows the animation alone (not `hidden`,
 * which Capsomer's reset holds with !important in a layer no component can outrank). The site's stylesheet (Capsomer's prose blocks)
 * shows the still with !important and hides the animation while the box is checked, and hides the control under reduced motion,
 * where the still already shows. The still is lazy, so it costs nothing until it is asked for.
 *
 * @param {import("hast").Element} animated
 * @param {import("hast").Element} img
 * @param {Array<{ type: string, srcSet: string, media?: string }>} stills
 * @param {string | undefined} sizes the image's own, written onto it only after this runs
 */
function motionControl(animated, img, stills, sizes) {
  const webp = stills.find((s) => s.type === "image/webp") ?? stills[stills.length - 1];
  const src = srcsetUrls(webp?.srcSet ?? "")[0];
  if (!webp || !src) return animated;
  const { alt, width, height } = /** @type {Record<string, unknown>} */ (img.properties);
  const still = el("picture", { className: ["motion-still"], style: "display:none" }, [
    ...stills
      .filter((s) => s !== webp)
      .map((s) => el("source", { type: s.type, srcSet: s.srcSet, ...(sizes ? { sizes } : {}) })),
    el("img", {
      src,
      srcSet: webp.srcSet,
      ...(sizes ? { sizes } : {}),
      alt,
      width,
      height,
      loading: "lazy",
      decoding: "async",
    }),
  ]);
  const control = el("label", { className: ["motion-pause"] }, [
    el("input", { type: "checkbox" }),
    { type: "text", value: " Pause animation" },
  ]);
  return el("span", { className: ["motion"] }, [animated, still, control]);
}

/**
 * The anchor and srcset come from one decision in one visitor so they cannot disagree about a storage tier. The first image is eager
 * with fetchpriority=high: it is usually the LCP, and a page that renders several bodies passes one `priority` to all of them so only
 * the page's first takes it. The site decides, through media.imageProps, which images are responsive; an image it returns null for
 * keeps the attributes the resolver gives it and nothing more. The resolver's size also sizes a diagram, a video (from its poster) and
 * an embed's poster, and its credit and license are shown and returned for the page's ImageObjects.
 *
 * @param {string} file
 * @param {(src: string) => Promise<ImageFacts | null>} resolveImage
 * @param {Array<Promise<void>>} pending
 * @param {NonNullable<MediaOptions["imageProps"]>} imageProps
 * @param {{ taken: boolean }} priority
 * @param {{ images: RenderedImage[], videos: RenderedVideo[], warnings: Array<{ line: number | null, message: string }>, after: Array<() => void> }} sinks
 */
export function rehypeImageSources(file, resolveImage, pending, imageProps, priority, sinks) {
  return (/** @type {import("hast").Root} */ tree) => {
    /** @type {Map<any, any>} */
    const parents = new Map();
    visit(tree, (node, _index, parent) => {
      if (parent) parents.set(node, parent);
    });
    /** @param {string} src @param {(facts: ImageFacts | null) => void} then */
    const resolved = (src, then) => pending.push(resolveImage(src).then(then));

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "video" && node.properties?.poster) {
        const video = node;
        const track = video.children.find((c) => c.type === "element" && c.tagName === "track");
        const poster = String(video.properties.poster);
        /** @type {RenderedVideo} */
        const entry = {
          kind: "file",
          url: String(video.properties.src ?? ""),
          title: String(video.properties.ariaLabel ?? ""),
          poster,
          ...(track?.type === "element" ? { captions: String(track.properties?.src ?? "") } : {}),
        };
        sinks.videos.push(entry);
        sinks.after.push(() => {
          if (!entry.width)
            sinks.warnings.push({
              line: null,
              message: `video ${entry.url} has no size: the site has none for its poster ${entry.poster}`,
            });
        });
        resolved(poster, (size) => {
          video.properties = { ...video.properties, width: size?.width, height: size?.height };
          Object.assign(entry, size ? { width: size.width, height: size.height } : {});
        });
        return;
      }
      if (node.tagName === "a" && hasClass(node, "embed-link")) {
        // Only a video is a video: a song, a map or a post never becomes og:video or a VideoObject.
        const href = String(node.properties?.href ?? "");
        if (!EMBED_PROVIDERS.some((p) => p.kind === "video" && p.pattern.test(href))) return;
        const poster = node.children.find((c) => c.type === "element" && c.tagName === "img");
        sinks.videos.push({
          kind: "embed",
          url: String(node.properties?.href ?? ""),
          // The player without the autoplay a click asks for.
          embedUrl: String(node.properties?.dataEmbedSrc ?? "").replace(/[?&]autoplay=1$/, ""),
          title: String(node.properties?.dataEmbedTitle ?? ""),
          ...(poster?.type === "element" ? { poster: String(poster.properties?.src ?? "") } : {}),
        });
        return;
      }
      if (node.tagName !== "img") return;
      const classes = node.properties?.className ?? [];
      const src = String(node.properties?.src ?? "");
      // Left for rehypeUrlProtocols to show as text: no wrapper link, and the site's resolver is never handed a hostile URL.
      if (!isAllowedUrl(src)) return;
      // A diagram's asset is drawn by a build step; its size comes from the drawing (render-diagram.mjs). Checked by class, not plugin
      // order, so moving this plugin cannot re-enable it.
      if (Array.isArray(classes) && classes.includes("diagram-image")) return;

      const props = imageProps(src);
      // srcset and the placeholder are written after rehypeUrlProtocols has run, so they are checked here: a candidate URL outside the
      // policy drops the srcset, and a placeholder that is not the base64 form drops the placeholder.
      const responsive =
        props?.srcSet && srcsetUrls(props.srcSet).every(isAllowedUrl)
          ? { srcSet: props.srcSet, sizes: props.sizes }
          : {};
      // Each format the site offers becomes a <source>, AVIF before WebP, so the browser takes the first it reads (Astro's <Picture>),
      // with its media query, which is how an animation's still reaches a reader who asks for reduced motion. Only beside a valid
      // srcset, and each source is held to the same URL policy, so one bad candidate drops that source alone.
      const sources = responsive.srcSet
        ? (props?.sources ?? []).filter(
            (s) =>
              /^image\/[a-z0-9.+-]+$/.test(s.type) &&
              s.srcSet &&
              srcsetUrls(s.srcSet).every(isAllowedUrl) &&
              (s.media === undefined || MEDIA_QUERY.test(s.media)),
          )
        : [];
      const stills = sources.filter((s) => s.media && REDUCED_MOTION.test(s.media));

      // Links to the unsized original, which srcset never serves. A figure's light and dark pair is excluded, as diagrams are: an
      // anchor around the display: none half would be a focusable link with no name. So is a decorative image (`![""](x)`, alt ""):
      // its link would have no name either. An author's own link wins.
      const themed =
        Array.isArray(classes) &&
        (classes.includes("figure-light") || classes.includes("figure-dark"));
      const poster = hasClass(node, "embed-poster");
      // An author's link (or an embed's) is never wrapped again, and holds no pause control: a checkbox in an <a> is an interactive
      // element inside another.
      const inLink = parent?.type === "element" && parent.tagName === "a";
      const wrappable =
        !themed &&
        src.length > 0 &&
        node.properties?.alt !== "" &&
        parent &&
        typeof index === "number" &&
        parent.children[index] === node &&
        !inLink;
      /** @type {import("hast").Element} */
      const picture =
        sources.length > 0
          ? el("picture", {}, [
              ...sources.map((s) =>
                el("source", {
                  type: s.type,
                  srcSet: s.srcSet,
                  ...(responsive.sizes ? { sizes: responsive.sizes } : {}),
                  ...(s.media ? { media: s.media } : {}),
                }),
              ),
              node,
            ])
          : node;
      const linked = wrappable
        ? el("a", { className: ["image-link"], href: props?.href ?? src }, [picture])
        : picture;
      const shown =
        stills.length > 0 && !themed && !inLink
          ? motionControl(linked, node, stills, responsive.sizes)
          : linked;
      if (
        shown !== node &&
        parent &&
        typeof index === "number" &&
        parent.children[index] === node
      ) {
        parent.children[index] = shown;
        parents.set(shown, parent);
      }

      // Counted after every exclusion, so the first image that gets attributes gets the eager pair. A themed half is never first: an
      // eager image loads while display: none, so the hidden half would take the priority, and a lazy one loads only once shown.
      const first = !themed && !priority.taken;
      if (first) priority.taken = true;
      const dark = Array.isArray(classes) && classes.includes("figure-dark");

      /** @type {ImageFacts | null} */
      let facts = null;
      // In document order once every lookup is back, so a gallery's credits and the image list do not depend on which came first.
      if (!dark && !poster) {
        sinks.after.push(() => {
          const rights = rightsOf(facts);
          if (rights.shown) showCredit(shown, parents, rights.shown);
          if (node.properties.alt === "") return;
          sinks.images.push({
            src,
            alt: String(node.properties.alt ?? ""),
            ...(facts?.width && facts.height ? { width: facts.width, height: facts.height } : {}),
            ...(rights.credit ? { creditText: rights.credit } : {}),
            ...(rights.notice ? { copyrightNotice: rights.notice } : {}),
            ...(rights.licenseUrl ? { license: rights.licenseUrl } : {}),
          });
        });
      }

      resolved(src, (size) => {
        facts = size;
        // null: a site that stores no sizes; the image is written unsized rather than refused.
        const { width, height, placeholder } = size ?? {};
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
        if (shown !== linked) {
          const still = /** @type {any} */ (shown.children[1]).children.at(-1);
          still.properties = { ...still.properties, width, height };
        }
      });
    });
  };
}
