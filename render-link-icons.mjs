// Outside sites' icons, fetched once when a page is published and served from the site's own origin, so a reader's browser never
// asks another site (or an icon service) for one. The site gives a store, `{ get(host), put(host, bytes, type) }`, in R2, KV or
// files as it likes; rehypeLinks (render-links.mjs) asks it for each away host and writes `<img class="cap-link-icon">` from the
// answer, and `linkIconResponse` is the one route that serves the stored bytes.
//
// Here and not in site-runtime: the fetch is a step of rendering a body, which site-runtime never does, and Prelum already ships the
// responses for what it publishes (robotsResponse, markdownResponse, keyFileResponse). Web-standard only, so it runs in a Worker.
//
// What it trusts of another site: nothing. Only https, only a public host name (no IP literal, no localhost or .local), a byte cap
// and a time cap on every request, the type read from the bytes rather than the header, and an SVG refused when it holds anything
// that could run or load (it is also served with a sandboxing policy, so one that slipped through cannot run on the site's origin).

import { readUpTo, shrinkPng } from "./render-png.mjs";

/** Where the icons are served unless the site says otherwise: `/link-icons/<host>.<ext>`. */
export const LINK_ICON_PATH = "/link-icons";

/** An icon over this is refused: a favicon.ico with 16 to 256 pixel images is about 30 KB. */
export const LINK_ICON_MAX_BYTES = 64 * 1024;

/** Each request gives up after this, so a slow host costs a publish at most a few seconds. */
export const LINK_ICON_TIMEOUT_MS = 3000;

/** The home page is read only this far looking for its `<link rel="icon">`, which is in the head. */
const PAGE_MAX_BYTES = 256 * 1024;

/** The image types kept, and the extension each is served under. */
const EXTENSIONS = new Map([
  ["image/png", "png"],
  ["image/x-icon", "ico"],
  ["image/gif", "gif"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

const TYPES = new Map([...EXTENSIONS].map(([type, ext]) => [ext, type]));

/**
 * @typedef {object} LinkIconStore The site's own storage. A host with no usable icon is put with no bytes and an empty type, so it
 *   is not fetched again; delete the entry to try it again.
 * @property {(host: string) => Promise<{ bytes: Uint8Array | ArrayBuffer, type: string } | null | undefined>} get
 * @property {(host: string, bytes: Uint8Array, type: string) => Promise<unknown>} put
 *
 * @typedef {object} LinkIconOptions
 * @property {LinkIconStore} store
 * @property {string} [path] Where the site serves them, `/link-icons` unless given. The path `linkIconResponse` is given too.
 * @property {typeof fetch} [fetch] The fetch to use; the global one unless given (a test passes a fake).
 * @property {number} [maxBytes] LINK_ICON_MAX_BYTES unless given.
 * @property {number} [timeoutMs] LINK_ICON_TIMEOUT_MS unless given.
 */

/** A name a public site could have. @param {string} host */
const publicHost = (host) =>
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) &&
  // Not an IP literal in any form (decimal, 0x7f.1): a real top-level domain has a letter, and IPv6 never matches the pattern above.
  /\.[a-z][a-z0-9-]*$/.test(host) &&
  // Names that resolve to a private address (an IP in the name, a LAN suffix) are not public sites.
  !/(?:^|\.)(?:localhost|local|internal|home\.arpa|invalid|nip\.io|sslip\.io|localtest\.me|lan|corp|localdomain|intranet|private)$/.test(
    host,
  );

/**
 * The type the bytes are, by their signature, whatever the header said. An SVG is text that starts with `<svg` or an XML
 * declaration, and comes back only when nothing in it could run or load: no script, event handler, foreignObject, frame, entity,
 * style import, and no link or url() that leaves the file.
 *
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function linkIconType(bytes) {
  const at = (/** @type {number[]} */ ...signature) =>
    signature.every((byte, i) => bytes[i] === byte);
  if (at(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0, 1, 0)) return "image/x-icon";
  if (at(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
    return "image/webp";
  const text = new TextDecoder().decode(bytes).replace(/^﻿/, "").trimStart();
  if (!/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return null;
  if (
    /<(?:script|foreignObject|iframe|embed|object|use|image|a)\b|<!(?:ENTITY|DOCTYPE)|\bon[a-z]+\s*=|javascript:|data:|@import/i.test(
      text,
    )
  )
    return null;
  // A prefixed element (<svg:script>) is the same tag under another name; a CSS escape or a character reference spells a blocked word
  // (j\61vascript:, &#106;avascript:); any backslash is refused, since CSS reads u\rl( as url( past the checks above.
  if (/<\/?[\w.-]+:/.test(text) || /\\/.test(text) || /&#/.test(text)) return null;
  if (/\b(?:xlink:)?href\s*=\s*["']?(?!#)/i.test(text) || /url\(\s*["']?(?!#)/i.test(text))
    return null;
  return "image/svg+xml";
}

/**
 * The body, or null once it passes `max`: the declared length is not trusted, so the stream is counted as it is read.
 *
 * @param {Response} response
 * @param {number} max
 */
async function bodyUpTo(response, max) {
  if (Number(response.headers.get("Content-Length") ?? 0) > max || !response.body) {
    void response.body?.cancel();
    return null;
  }
  const reader = response.body.getReader();
  return readUpTo(reader, max);
}

const MAX_REDIRECTS = 3;

/**
 * One request, https only to a public host and after every redirect, capped in time and bytes. Never throws. Null is an answer
 * that has no icon; undefined is no answer (a timeout, a network error, a 5xx), which is not stored as a miss.
 *
 * @param {string} url
 * @param {number} max
 * @param {Required<Pick<LinkIconOptions, "fetch" | "timeoutMs">>} options
 */
async function fetchCapped(url, max, { fetch, timeoutMs }) {
  try {
    // Redirects are followed by hand, so each hop is checked before it is requested, not after the fetch has already gone there.
    let target = new URL(url);
    for (let hop = 0; ; hop += 1) {
      if (target.protocol !== "https:" || !publicHost(target.hostname)) return null;
      const response = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 300 && response.status < 400) {
        void response.body?.cancel();
        const location = response.headers.get("Location");
        if (!location || hop >= MAX_REDIRECTS) return null;
        target = new URL(location, target);
        continue;
      }
      if (!response.ok) {
        void response.body?.cancel();
        return response.status >= 500 ? undefined : null;
      }
      const bytes = await bodyUpTo(response, max);
      return bytes ? { bytes, url: target.href } : null;
    }
  } catch {
    return undefined;
  }
}

/** The icon is shown at 16 CSS pixels; 32 covers a 2x screen, and a bigger one only costs bytes and decoding. */
export const LINK_ICON_SIZE = /** @type {const} */ (32);

/**
 * An icon no bigger than it is shown needs to be. A favicon.ico holds several sizes: the smallest that covers LINK_ICON_SIZE is
 * kept, alone, and one that is a PNG is shrunk like any PNG. Other types (an SVG scales; a GIF, JPEG or WebP favicon is rare) are
 * kept as they are, as is anything this cannot read. A PNG that is absurdly large (see MAX_ICON_PIXELS) or inflates past its
 * declared size is refused: null.
 *
 * @param {{ bytes: Uint8Array, type: string }} icon
 * @returns {Promise<{ bytes: Uint8Array, type: string } | null>}
 */
export async function fitLinkIcon(icon) {
  try {
    if (icon.type === "image/png") {
      const bytes = await shrinkPng(icon.bytes, LINK_ICON_SIZE);
      return bytes && { bytes, type: icon.type };
    }
    if (icon.type !== "image/x-icon") return icon;
    const view = new DataView(icon.bytes.buffer, icon.bytes.byteOffset, icon.bytes.byteLength);
    const entries = Array.from({ length: view.getUint16(4, true) }, (_, i) => {
      const at = 6 + i * 16;
      return {
        size: icon.bytes[at] || 256,
        entry: icon.bytes.slice(at, at + 16),
        length: view.getUint32(at + 8, true),
        offset: view.getUint32(at + 12, true),
      };
    }).filter((e) => e.offset + e.length <= icon.bytes.length);
    const covering = entries
      .filter((e) => e.size >= LINK_ICON_SIZE)
      .sort((a, b) => a.size - b.size);
    const best = covering[0] ?? entries.sort((a, b) => b.size - a.size)[0];
    if (!best) return icon;
    const image = icon.bytes.slice(best.offset, best.offset + best.length);
    // A PNG inside is served as the PNG it is, shrunk; a bitmap stays in an ICO of its own.
    if (linkIconType(image) === "image/png") {
      const bytes = await shrinkPng(image, LINK_ICON_SIZE);
      return bytes && { bytes, type: "image/png" };
    }
    const one = new Uint8Array(22 + image.length);
    one.set([0, 0, 1, 0, 1, 0]);
    one.set(best.entry, 6);
    new DataView(one.buffer).setUint32(18, 22, true);
    one.set(image, 22);
    return { bytes: one, type: icon.type };
  } catch {
    return icon;
  }
}

/**
 * The host's own icon: /favicon.ico, then the first `<link rel="icon">` of its home page. Never a third-party icon service.
 *
 * @param {string} host
 * @param {Required<Omit<LinkIconOptions, "store" | "path">>} options
 * @returns {Promise<{ bytes: Uint8Array, type: string } | null | undefined>} undefined when a host could not be reached
 */
async function fetchLinkIcon(host, options) {
  const image = async (/** @type {string} */ url) => {
    const got = await fetchCapped(url, options.maxBytes, options);
    const type = got && linkIconType(got.bytes);
    return got && type
      ? fitLinkIcon({ bytes: got.bytes, type })
      : got === undefined
        ? undefined
        : null;
  };
  const direct = await image(`https://${host}/favicon.ico`);
  if (direct) return direct;
  const page = await fetchCapped(`https://${host}/`, PAGE_MAX_BYTES, options);
  if (!page) return page === undefined ? undefined : direct;
  const html = new TextDecoder().decode(page.bytes);
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attribute = (/** @type {string} */ name) => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
      return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").replaceAll("&amp;", "&");
    };
    if (!attribute("rel").toLowerCase().split(/\s+/).includes("icon")) continue;
    const href = attribute("href");
    if (!href) continue;
    try {
      return await image(new URL(href, page.url).href);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * The stored icon's type for a host, fetching and storing it on a miss; null when the host has none the step will serve. A store
 * that fails is a missing icon, never a failed render.
 *
 * @param {string} host a bare host name, as rehypeLinks gives it
 * @param {LinkIconOptions} options
 * @returns {Promise<string | null>}
 */
export async function lookupLinkIcon(host, options) {
  if (!publicHost(host)) return null;
  try {
    const stored = await options.store.get(host);
    if (stored) return EXTENSIONS.has(stored.type) ? stored.type : null;
    const icon = await fetchLinkIcon(host, {
      fetch: options.fetch ?? globalThis.fetch,
      maxBytes: options.maxBytes ?? LINK_ICON_MAX_BYTES,
      timeoutMs: options.timeoutMs ?? LINK_ICON_TIMEOUT_MS,
    });
    if (icon === undefined) return null;
    await options.store.put(host, icon?.bytes ?? new Uint8Array(0), icon?.type ?? "");
    return icon?.type ?? null;
  } catch {
    return null;
  }
}

/**
 * Where the page finds a host's icon.
 *
 * @param {string} path
 * @param {string} host
 * @param {string} type
 */
export function linkIconSrc(path, host, type) {
  return `${path.replace(/\/$/, "")}/${host}.${EXTENSIONS.get(type)}`;
}

/**
 * The route: the stored icon for `/link-icons/<host>.<ext>`, a year's immutable cache (an icon is fetched once, so its URL never
 * holds other bytes), and `headers`, the site's set for a file it did not write: site-runtime's UPLOAD_HEADERS (nosniff and a
 * policy that lets nothing in the file run or load). Security headers are site-runtime's, so the site passes them; there is no
 * default. A 404 for a host with no icon, or an extension that is not the stored type's; null when the path is not under `path`,
 * so a site writes `return (await linkIconResponse(url.pathname, store, { headers: UPLOAD_HEADERS })) ?? next()`.
 *
 * @param {string} pathname
 * @param {Pick<LinkIconStore, "get">} store
 * @param {{ headers: Readonly<Record<string, string>>, path?: string }} options
 * @returns {Promise<Response | null>}
 */
export async function linkIconResponse(pathname, store, { headers, path = LINK_ICON_PATH }) {
  if (!headers)
    throw new TypeError("linkIconResponse needs headers: site-runtime's UPLOAD_HEADERS");
  const prefix = `${path.replace(/\/$/, "")}/`;
  if (!pathname.startsWith(prefix)) return null;
  const match = /^([a-z0-9.-]+)\.([a-z]+)$/.exec(pathname.slice(prefix.length));
  const stored = match && publicHost(match[1] ?? "") ? await store.get(match[1] ?? "") : null;
  if (!stored || stored.bytes.byteLength === 0 || TYPES.get(match?.[2] ?? "") !== stored.type) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new Response(/** @type {BodyInit} */ (stored.bytes), {
    headers: {
      "Content-Type": stored.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      ...headers,
    },
  });
}
