/**
 * The bytes of `reader`, or null once they pass `max`.
 *
 * @param {ReadableStreamDefaultReader<Uint8Array>} reader
 * @param {number} max
 */
export function readUpTo(reader: ReadableStreamDefaultReader<Uint8Array>, max: number): Promise<Uint8Array<ArrayBuffer> | null>;
/**
 * A PNG shrunk to `size` pixels a side by averaging, with alpha weighted so a transparent edge does not darken, as an 8-bit RGBA PNG.
 * Only the forms favicons use are read (8-bit gray, RGB, RGBA and gray-alpha, and palettes of 1 to 8 bits, not interlaced); any other,
 * or one already small enough, comes back as it was. Null when it declares more than MAX_ICON_PIXELS or inflates past its declared size.
 *
 * @param {Uint8Array} png
 * @param {number} size
 * @returns {Promise<Uint8Array | null>}
 */
export function shrinkPng(png: Uint8Array, size: number): Promise<Uint8Array | null>;
