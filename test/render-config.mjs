// How the render tests configure the pipeline: dustinedwards-info's configuration, with a stand-in for its media rules (the
// real ones stay in that site). Shared by the render tests so each renders the way a site would.

import { readFileSync } from "node:fs";

import { FAMILY_SITES } from "capsomer/behavior/family-footer";

import { createHighlight } from "../render-highlight.mjs";
import { editorialPack } from "../render-packs.mjs";

/** The media rules the fixtures stand in for: /media/<key> is an R2 object served at several widths. */
export const media = {
  /** @param {string} raw */
  keyOf(raw) {
    const path = raw.split(/[?#]/)[0] ?? "";
    return path.startsWith("/media/") ? path.slice("/media/".length) || null : null;
  },
  /** @param {string} src */
  imageProps(src) {
    if (!src.startsWith("/media/")) return null;
    const key = src.slice("/media/".length);
    const srcSet = (/** @type {string} */ f) => [640, 1024, 1408].map((w) => `/media/${key}?w=${w}${f} ${w}w`).join(", ");
    return {
      srcSet: srcSet(""),
      sizes: "(min-width: 46rem) 704px, calc(100vw - 2rem)",
      href: `/media/${key}`,
      sources: [
        { type: "image/avif", srcSet: srcSet("&f=avif") },
        { type: "image/webp", srcSet: srcSet("") },
      ],
    };
  },
};

/** @param {string} src */
export async function resolveImage(src) {
  // A stand-in for the site's image index. Only /media/ images get a placeholder, as on that site.
  const dimensions = /-(\d+)x(\d+)\./.exec(src);
  const width = dimensions ? Number(dimensions[1]) : 800;
  const height = dimensions ? Number(dimensions[2]) : 600;
  return src.startsWith("/media/")
    ? { width, height, placeholder: "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==" }
    : { width, height };
}

export const packs = [editorialPack({ assetPrefix: "example-" })];

export const highlight = createHighlight();

/** The link contract's facts: the site's origin, Capsomer's family list, and a size for the corpus's one file. */
export const links = {
  origin: "https://dustinedwards.info",
  family: FAMILY_SITES,
  /** @param {string} href */
  fileSize: async (href) => (href.endsWith("/cv.pdf") ? 2_200_000 : null),
};

/** A store already holding example.com's icon and knowing every other host has none, so no render here reaches the network. */
export const linkIcons = {
  store: {
    /** @param {string} host */
    get: async (host) => ({ bytes: new Uint8Array(host === "example.com" ? [0x89, 0x50, 0x4e, 0x47] : []), type: host === "example.com" ? "image/png" : "" }),
    put: async () => {},
  },
};

/** The options a site configured like dustinedwards-info passes. */
export const siteOptions = { packs, media, highlight, links, linkIcons };

/** @param {string} name a file in test/fixtures/render, without .md */
export function fixture(name) {
  return readFileSync(new URL(`./fixtures/render/${name}.md`, import.meta.url), "utf8");
}

export const FIXTURES = ["prose", "math", "untrusted-math", "code", "directives", "charts", "blocks"];
