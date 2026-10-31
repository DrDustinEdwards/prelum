#!/usr/bin/env node
// prelum-icons: draw a site's icon files from one SVG, at the paths `iconLinks` and `webManifest` name.
//
//   prelum-icons --svg brand/mark.svg --background "#4F2D7F" [--maskable brand/mark-maskable.svg] [--out public]
//
// Writes favicon.ico (16, 32 and 48 pixels), icon.svg, apple-touch-icon.png (180, on the background, since iOS fills
// transparency with black), icon-192.png, icon-512.png and icon-maskable-512.png (the mark inside the safe circle on the
// background, or --maskable as drawn). Needs @resvg/resvg-js, an optional peer.

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { ICONS, icoFile } from "../icons.mjs";

const { values } = parseArgs({ options: { svg: { type: "string" }, background: { type: "string" }, maskable: { type: "string" }, out: { type: "string", default: "public" } } });
if (!values.svg || !values.background) {
  console.error('usage: prelum-icons --svg mark.svg --background "#4F2D7F" [--maskable mark-maskable.svg] [--out public]');
  process.exit(2);
}
const { Resvg } = await import("@resvg/resvg-js");
const mark = await readFile(values.svg, "utf8");
const png = (/** @type {string} */ svg, /** @type {number} */ size) => new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
// The mark scaled into a square of the background. A maskable icon's safe zone is the centered circle of 80% of the width
// (W3C, "Icon masks"), and a square that fits in it is 80% / sqrt(2), about 57%.
const onBackground = (/** @type {number} */ share) => {
  const inset = ((1 - share) / 2) * 512;
  const href = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${values.background}"/><image href="${href}" x="${inset}" y="${inset}" width="${512 * share}" height="${512 * share}"/></svg>`;
};
const maskable = values.maskable ? await readFile(values.maskable, "utf8") : onBackground(0.8 / Math.SQRT2);

const out = values.out;
await mkdir(out, { recursive: true });
const file = (/** @type {string} */ path) => join(out, path.slice(1));
await writeFile(file(ICONS.ico), icoFile([16, 32, 48].map((size) => ({ size, png: png(mark, size) }))));
await copyFile(values.svg, file(ICONS.svg));
await writeFile(file(ICONS.apple), png(onBackground(0.8), 180));
await writeFile(file(ICONS.any192), png(mark, 192));
await writeFile(file(ICONS.any512), png(mark, 512));
await writeFile(file(ICONS.maskable), png(maskable, 512));
console.log(`prelum-icons: wrote ${Object.values(ICONS).filter((path) => path !== ICONS.manifest).join(", ")} to ${out}`);
