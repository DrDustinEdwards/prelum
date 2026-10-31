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
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) && !/^[\d.]+$/.test(host) && !/(?:^|\.)(?:localhost|local|internal|home\.arpa|invalid)$/.test(host);

/**
 * The type the bytes are, by their signature, whatever the header said. An SVG is text that starts with `<svg` or an XML
 * declaration, and comes back only when nothing in it could run or load: no script, event handler, foreignObject, frame, entity,
 * style import, and no link or url() that leaves the file.
 *
 * @param {Uint8Array} bytes
 * @returns {string | null}
 */
export function linkIconType(bytes) {
  const at = (/** @type {number[]} */ ...signature) => signature.every((byte, i) => bytes[i] === byte);
  if (at(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0, 1, 0)) return "image/x-icon";
  if (at(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  const text = new TextDecoder().decode(bytes).replace(/^﻿/, "").trimStart();
  if (!/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return null;
  if (/<(?:script|foreignObject|iframe|embed|object|use|image|a)\b|<!(?:ENTITY|DOCTYPE)|\bon[a-z]+\s*=|javascript:|data:|@import/i.test(text)) return null;
  if (/\b(?:xlink:)?href\s*=\s*["']?(?!#)/i.test(text) || /url\(\s*["']?(?!#)/i.test(text)) return null;
  return "image/svg+xml";
}

/**
 * The body, or null once it passes `max`: the declared length is not trusted, so the stream is counted as it is read.
 *
 * @param {Response} response
 * @param {number} max
 */
async function bodyUpTo(response, max) {
  if (Number(response.headers.get("Content-Length") ?? 0) > max || !response.body) return null;
  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/**
 * One request, https only to a public host and after every redirect, capped in time and bytes. Never throws.
 *
 * @param {string} url
 * @param {number} max
 * @param {Required<Pick<LinkIconOptions, "fetch" | "timeoutMs">>} options
 */
async function fetchCapped(url, max, { fetch, timeoutMs }) {
  try {
    const target = new URL(url);
    if (target.protocol !== "https:" || !publicHost(target.hostname)) return null;
    const response = await fetch(target, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const final = response.url ? new URL(response.url) : target;
    if (!response.ok || final.protocol !== "https:" || !publicHost(final.hostname)) return null;
    const bytes = await bodyUpTo(response, max);
    return bytes ? { bytes, url: final.href } : null;
  } catch {
    return null;
  }
}

/** The icon is shown at 16 CSS pixels; 32 covers a 2x screen, and a bigger one only costs bytes and decoding. */
export const LINK_ICON_SIZE = /** @type {const} */ (32);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** @param {Uint8Array} bytes */
const crc32 = (bytes) => {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** @param {Uint8Array} bytes @param {"compress" | "decompress"} way */
const zlib = async (bytes, way) => {
  const stream = new Blob([/** @type {BlobPart} */ (bytes)]).stream().pipeThrough(way === "compress" ? new CompressionStream("deflate") : new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * A PNG shrunk to `size` pixels a side by averaging, with alpha weighted so a transparent edge does not darken, as an 8-bit RGBA PNG.
 * Only the forms favicons use are read (8-bit gray, RGB, RGBA and gray-alpha, and palettes of 1 to 8 bits, not interlaced); any other,
 * or one already small enough, comes back as it was.
 *
 * @param {Uint8Array} png
 * @param {number} size
 */
async function shrinkPng(png, size) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const [depth, color, , , interlace] = png.slice(24, 29);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color ?? -1];
  if (Math.max(width, height) <= size || !channels || interlace || (color !== 3 && depth !== 8) || ![1, 2, 4, 8].includes(depth ?? 0)) return png;
  /** @type {Uint8Array[]} */
  const data = [];
  let palette = new Uint8Array(0);
  let alphas = new Uint8Array(0);
  for (let at = 8; at + 8 <= png.length; ) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.slice(at + 4, at + 8));
    const body = png.slice(at + 8, at + 8 + length);
    if (type === "IDAT") data.push(body);
    if (type === "PLTE") palette = body;
    if (type === "tRNS") alphas = body;
    at += 12 + length;
  }
  const raw = await zlib(new Uint8Array(await new Blob(/** @type {BlobPart[]} */ (data)).arrayBuffer()), "decompress");
  const bpp = Math.max(1, ((depth ?? 8) * channels) >> 3);
  const stride = Math.ceil((width * channels * (depth ?? 8)) / 8);
  const rgba = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const a = i >= bpp ? (line[i - bpp] ?? 0) : 0;
      const b = previous[i] ?? 0;
      const c = i >= bpp ? (previous[i - bpp] ?? 0) : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      const predictor = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter ?? 0] ?? 0;
      line[i] = ((line[i] ?? 0) + predictor) & 0xff;
    }
    previous = line;
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      if (color === 3) {
        const bit = x * (depth ?? 8);
        const index = ((line[bit >> 3] ?? 0) >> (8 - (depth ?? 8) - (bit & 7))) & ((1 << (depth ?? 8)) - 1);
        rgba.set([palette[index * 3] ?? 0, palette[index * 3 + 1] ?? 0, palette[index * 3 + 2] ?? 0, alphas[index] ?? 255], out);
      } else {
        const px = line.slice(x * channels, x * channels + channels);
        const gray = channels <= 2;
        rgba.set([px[0] ?? 0, gray ? (px[0] ?? 0) : (px[1] ?? 0), gray ? (px[0] ?? 0) : (px[2] ?? 0), channels === 2 ? (px[1] ?? 255) : channels === 4 ? (px[3] ?? 255) : 255], out);
      }
    }
  }
  // Box averaging: each output pixel takes every source pixel it overlaps, weighted by the overlap.
  const scale = Math.max(width, height) / size;
  const w = Math.max(1, Math.round(width / scale));
  const h = Math.max(1, Math.round(height / scale));
  const out = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sum = [0, 0, 0, 0];
      let area = 0;
      for (let sy = Math.floor(y * scale); sy < Math.min(height, Math.ceil((y + 1) * scale)); sy += 1) {
        const wy = Math.min(sy + 1, (y + 1) * scale) - Math.max(sy, y * scale);
        for (let sx = Math.floor(x * scale); sx < Math.min(width, Math.ceil((x + 1) * scale)); sx += 1) {
          const weight = wy * (Math.min(sx + 1, (x + 1) * scale) - Math.max(sx, x * scale));
          const at = (sy * width + sx) * 4;
          const alpha = (rgba[at + 3] ?? 0) * weight;
          for (let k = 0; k < 3; k += 1) sum[k] = (sum[k] ?? 0) + (rgba[at + k] ?? 0) * alpha;
          sum[3] = (sum[3] ?? 0) + alpha;
          area += weight;
        }
      }
      const alpha = sum[3] ?? 0;
      const at = y * (w * 4 + 1) + 1 + x * 4;
      out.set(alpha > 0 ? [0, 1, 2].map((k) => Math.round((sum[k] ?? 0) / alpha)) : [0, 0, 0], at);
      out[at + 3] = Math.round(alpha / area);
    }
  }
  /** @param {string} type @param {Uint8Array} body */
  const chunk = (type, body) => {
    const typed = new Uint8Array([...type].map((ch) => ch.charCodeAt(0)).concat([...body]));
    const bytes = new Uint8Array(12 + body.length);
    const frame = new DataView(bytes.buffer);
    frame.setUint32(0, body.length);
    bytes.set(typed, 4);
    frame.setUint32(8 + body.length, crc32(typed));
    return bytes;
  };
  const header = new Uint8Array(13);
  new DataView(header.buffer).setUint32(0, w);
  new DataView(header.buffer).setUint32(4, h);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [png.slice(0, 8), chunk("IHDR", header), chunk("IDAT", await zlib(out, "compress")), chunk("IEND", new Uint8Array(0))];
  return new Uint8Array(await new Blob(/** @type {BlobPart[]} */ (parts)).arrayBuffer());
}

/**
 * An icon no bigger than it is shown needs to be. A favicon.ico holds several sizes: the smallest that covers LINK_ICON_SIZE is
 * kept, alone, and one that is a PNG is shrunk like any PNG. Other types (an SVG scales; a GIF, JPEG or WebP favicon is rare) are
 * kept as they are, as is anything this cannot read.
 *
 * @param {{ bytes: Uint8Array, type: string }} icon
 * @returns {Promise<{ bytes: Uint8Array, type: string }>}
 */
export async function fitLinkIcon(icon) {
  try {
    if (icon.type === "image/png") return { bytes: await shrinkPng(icon.bytes, LINK_ICON_SIZE), type: icon.type };
    if (icon.type !== "image/x-icon") return icon;
    const view = new DataView(icon.bytes.buffer, icon.bytes.byteOffset, icon.bytes.byteLength);
    const entries = Array.from({ length: view.getUint16(4, true) }, (_, i) => {
      const at = 6 + i * 16;
      return { size: icon.bytes[at] || 256, entry: icon.bytes.slice(at, at + 16), length: view.getUint32(at + 8, true), offset: view.getUint32(at + 12, true) };
    }).filter((e) => e.offset + e.length <= icon.bytes.length);
    const covering = entries.filter((e) => e.size >= LINK_ICON_SIZE).sort((a, b) => a.size - b.size);
    const best = covering[0] ?? entries.sort((a, b) => b.size - a.size)[0];
    if (!best) return icon;
    const image = icon.bytes.slice(best.offset, best.offset + best.length);
    // A PNG inside is served as the PNG it is, shrunk; a bitmap stays in an ICO of its own.
    if (linkIconType(image) === "image/png") return { bytes: await shrinkPng(image, LINK_ICON_SIZE), type: "image/png" };
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
 * @returns {Promise<{ bytes: Uint8Array, type: string } | null>}
 */
async function fetchLinkIcon(host, options) {
  const image = async (/** @type {string} */ url) => {
    const got = await fetchCapped(url, options.maxBytes, options);
    const type = got && linkIconType(got.bytes);
    return got && type ? fitLinkIcon({ bytes: got.bytes, type }) : null;
  };
  const direct = await image(`https://${host}/favicon.ico`);
  if (direct) return direct;
  const page = await fetchCapped(`https://${host}/`, PAGE_MAX_BYTES, options);
  if (!page) return null;
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
 * holds other bytes), nosniff, and a policy that lets nothing in the file run or load. A 404 for a host with no icon, or an extension
 * that is not the stored type's; null when the path is not under `path`, so a site writes
 * `return (await linkIconResponse(url.pathname, store)) ?? next()`.
 *
 * @param {string} pathname
 * @param {Pick<LinkIconStore, "get">} store
 * @param {{ path?: string }} [options]
 * @returns {Promise<Response | null>}
 */
export async function linkIconResponse(pathname, store, { path = LINK_ICON_PATH } = {}) {
  const prefix = `${path.replace(/\/$/, "")}/`;
  if (!pathname.startsWith(prefix)) return null;
  const match = /^([a-z0-9.-]+)\.([a-z]+)$/.exec(pathname.slice(prefix.length));
  const stored = match && publicHost(match[1] ?? "") ? await store.get(match[1] ?? "") : null;
  if (!stored || stored.bytes.byteLength === 0 || TYPES.get(match?.[2] ?? "") !== stored.type) {
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }
  return new Response(/** @type {BodyInit} */ (stored.bytes), {
    headers: {
      "Content-Type": stored.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
