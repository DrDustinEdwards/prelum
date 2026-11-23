// A PNG shrunk to the size an icon is shown at, and the capped stream read it and the icon fetch share.

import { crc32 } from "@dustinedwards/site-runtime/encoding";

/**
 * The bytes of `reader`, or null once they pass `max`.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {number} max
 */
export async function readUpTo(reader, max) {
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

/** @param {Uint8Array} bytes */
const deflate = async (bytes) => {
  const stream = new Blob([/** @type {BlobPart} */ (bytes)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * Inflated, or null once the output passes `max`: a few KB of zlib can inflate to gigabytes, so the stream is counted as it is read.
 *
 * @param {Uint8Array} bytes
 * @param {number} max
 */
const inflate = async (bytes, max) => {
  const reader = new Blob([/** @type {BlobPart} */ (bytes)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"))
    .getReader();
  return readUpTo(reader, max);
};

/** A PNG icon with more pixels than this (2048 x 2048) is refused unread: decoding allocates four bytes a pixel. */
const MAX_ICON_PIXELS = 2048 * 2048;

/**
 * A PNG shrunk to `size` pixels a side by averaging, with alpha weighted so a transparent edge does not darken, as an 8-bit RGBA PNG.
 * Only the forms favicons use are read (8-bit gray, RGB, RGBA and gray-alpha, and palettes of 1 to 8 bits, not interlaced); any other,
 * or one already small enough, comes back as it was. Null when it declares more than MAX_ICON_PIXELS or inflates past its declared size.
 *
 * @param {Uint8Array} png
 * @param {number} size
 * @returns {Promise<Uint8Array | null>}
 */
export async function shrinkPng(png, size) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (png.length < 29 || width * height > MAX_ICON_PIXELS) return null;
  const [depth, color, , , interlace] = png.slice(24, 29);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color ?? -1];
  if (
    Math.max(width, height) <= size ||
    !channels ||
    interlace ||
    (color !== 3 && depth !== 8) ||
    ![1, 2, 4, 8].includes(depth ?? 0)
  )
    return png;
  /** @type {Uint8Array[]} */
  const data = [];
  let palette = new Uint8Array(0);
  let alphas = new Uint8Array(0);
  for (let at = 8; at + 8 <= png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.slice(at + 4, at + 8));
    const body = png.slice(at + 8, at + 8 + length);
    if (type === "IDAT") data.push(body);
    if (type === "PLTE") palette = body;
    if (type === "tRNS") alphas = body;
    at += 12 + length;
  }
  const bpp = Math.max(1, ((depth ?? 8) * channels) >> 3);
  const stride = Math.ceil((width * channels * (depth ?? 8)) / 8);
  const raw = await inflate(
    new Uint8Array(await new Blob(/** @type {BlobPart[]} */ (data)).arrayBuffer()),
    (stride + 1) * height,
  );
  if (!raw) return null;
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
      const predictor =
        [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter ?? 0] ?? 0;
      line[i] = ((line[i] ?? 0) + predictor) & 0xff;
    }
    previous = line;
    for (let x = 0; x < width; x += 1) {
      const out = (y * width + x) * 4;
      if (color === 3) {
        const bit = x * (depth ?? 8);
        const index =
          ((line[bit >> 3] ?? 0) >> (8 - (depth ?? 8) - (bit & 7))) & ((1 << (depth ?? 8)) - 1);
        rgba.set(
          [
            palette[index * 3] ?? 0,
            palette[index * 3 + 1] ?? 0,
            palette[index * 3 + 2] ?? 0,
            alphas[index] ?? 255,
          ],
          out,
        );
      } else {
        const px = line.slice(x * channels, x * channels + channels);
        const gray = channels <= 2;
        rgba.set(
          [
            px[0] ?? 0,
            gray ? (px[0] ?? 0) : (px[1] ?? 0),
            gray ? (px[0] ?? 0) : (px[2] ?? 0),
            channels === 2 ? (px[1] ?? 255) : channels === 4 ? (px[3] ?? 255) : 255,
          ],
          out,
        );
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
      for (
        let sy = Math.floor(y * scale);
        sy < Math.min(height, Math.ceil((y + 1) * scale));
        sy += 1
      ) {
        const wy = Math.min(sy + 1, (y + 1) * scale) - Math.max(sy, y * scale);
        for (
          let sx = Math.floor(x * scale);
          sx < Math.min(width, Math.ceil((x + 1) * scale));
          sx += 1
        ) {
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
    const typed = new Uint8Array(
      Array.from(type)
        .map((ch) => ch.charCodeAt(0))
        .concat([...body]),
    );
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
  const parts = [
    png.slice(0, 8),
    chunk("IHDR", header),
    chunk("IDAT", await deflate(out)),
    chunk("IEND", new Uint8Array(0)),
  ];
  return new Uint8Array(await new Blob(/** @type {BlobPart[]} */ (parts)).arrayBuffer());
}
