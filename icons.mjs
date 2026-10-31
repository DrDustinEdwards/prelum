/**
 * The icon files every site serves, at the same paths everywhere: what Google's favicon rules, iOS and an installable web app
 * each ask for. `prelum-icons` draws them from one SVG.
 */
export const ICONS = {
  ico: "/favicon.ico",
  svg: "/icon.svg",
  apple: "/apple-touch-icon.png",
  any192: "/icon-192.png",
  any512: "/icon-512.png",
  maskable: "/icon-maskable-512.png",
  manifest: "/site.webmanifest",
};

/**
 * The `<link>`s for the icons, in the shape React Router's `links` export takes. `favicon.ico` holds 16, 32 and 48 pixel
 * images (Google wants a multiple of 48); the SVG is for browsers that draw it.
 *
 * @returns {Array<{ rel: string, href: string, type?: string, sizes?: string }>}
 */
export function iconLinks() {
  return [
    { rel: "icon", href: ICONS.ico, sizes: "48x48" },
    { rel: "icon", href: ICONS.svg, type: "image/svg+xml" },
    { rel: "apple-touch-icon", href: ICONS.apple },
    { rel: "manifest", href: ICONS.manifest },
  ];
}

/**
 * The web app manifest, `site.webmanifest`, pointing at the icon files.
 *
 * @param {{ name: string, shortName?: string, description?: string, themeColor: string, backgroundColor: string,
 *   startUrl?: string, display?: "standalone" | "minimal-ui" | "browser", lang?: string }} site
 */
export function webManifest(site) {
  const png = (/** @type {string} */ src, /** @type {number} */ size, purpose = "any") => ({ src, sizes: `${size}x${size}`, type: "image/png", purpose });
  return {
    name: site.name,
    short_name: site.shortName ?? site.name,
    ...(site.description ? { description: site.description } : {}),
    ...(site.lang ? { lang: site.lang } : {}),
    start_url: site.startUrl ?? "/",
    display: site.display ?? "standalone",
    theme_color: site.themeColor,
    background_color: site.backgroundColor,
    icons: [png(ICONS.any192, 192), png(ICONS.any512, 512), png(ICONS.maskable, 512, "maskable")],
  };
}

/**
 * An `.ico` file holding PNG images, one per size: the format browsers and Google read from `/favicon.ico`.
 *
 * @param {Array<{ size: number, png: Uint8Array }>} images
 */
export function icoFile(images) {
  const header = 6 + 16 * images.length;
  const out = new Uint8Array(header + images.reduce((sum, image) => sum + image.png.length, 0));
  const view = new DataView(out.buffer);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = header;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    out[entry] = size >= 256 ? 0 : size;
    out[entry + 1] = size >= 256 ? 0 : size;
    view.setUint16(entry + 4, 1, true);
    view.setUint16(entry + 6, 32, true);
    view.setUint32(entry + 8, png.length, true);
    view.setUint32(entry + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}

/**
 * The live check for a site's icons, the site-wide half of `prelum-audit`: `/favicon.ico` answers an image, the home page
 * links an icon, an Apple touch icon and a manifest, and the manifest names the site and an icon at 192 and 512 pixels and a
 * maskable one, each of which loads.
 *
 * @param {{ origin: string, fetch: typeof fetch }} site
 * @returns {Promise<import("./audit.mjs").AuditFinding[]>}
 */
export async function auditIcons({ origin, fetch: fetcher }) {
  /** @type {import("./audit.mjs").AuditFinding[]} */
  const findings = [];
  const add = (/** @type {string} */ url, /** @type {string} */ check, /** @type {"error" | "warning"} */ severity, /** @type {string} */ detail) =>
    findings.push({ url, check, severity, detail });
  const get = (/** @type {string} */ url) => fetcher(url).catch(() => null);
  const isImage = (/** @type {Response | null} */ response) => Boolean(response?.ok && (response.headers.get("content-type") ?? "").startsWith("image/"));

  const ico = new URL(ICONS.ico, origin).href;
  const icoResponse = await get(ico);
  if (!isImage(icoResponse)) add(ico, "icon-missing", "error", `answers ${icoResponse?.status ?? "nothing"} ${icoResponse?.headers.get("content-type") ?? ""}`.trim());

  const home = await get(`${origin}/`);
  const html = home?.ok ? await home.text() : "";
  /** @type {Map<string, string>} */
  const links = new Map();
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = /\brel=["']?([^"'\s>]+(?:\s+[^"'\s>]+)*)/i.exec(tag)?.[1]?.toLowerCase();
    const href = /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (rel && href) for (const name of rel.split(/\s+/)) if (!links.has(name)) links.set(name, new URL(href.replace(/&amp;/g, "&"), `${origin}/`).href);
  }
  if (!links.has("icon")) add(`${origin}/`, "icon-link", "error", "the home page links no icon");
  for (const [rel, check] of [["apple-touch-icon", "icon-apple"], ["manifest", "icon-manifest"]]) {
    const href = links.get(rel);
    if (!href) add(`${origin}/`, check, "warning", `the home page links no ${rel}`);
    else if (rel === "apple-touch-icon" && !isImage(await get(href))) add(href, "icon-broken", "error", "the Apple touch icon does not load");
  }

  const manifestUrl = links.get("manifest");
  if (!manifestUrl) return findings;
  const manifest = await get(manifestUrl).then((response) => (response?.ok ? response.json() : null)).catch(() => null);
  if (!manifest || typeof manifest !== "object") {
    add(manifestUrl, "icon-manifest", "error", "the manifest does not load as JSON");
    return findings;
  }
  if (!manifest.name) add(manifestUrl, "icon-manifest", "warning", "the manifest has no name");
  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const sized = (/** @type {number} */ size) => icons.some((icon) => String(icon.sizes ?? "").split(/\s+/).includes(`${size}x${size}`));
  for (const size of [192, 512]) if (!sized(size)) add(manifestUrl, "icon-manifest", "warning", `the manifest has no ${size}x${size} icon`);
  if (!icons.some((icon) => String(icon.purpose ?? "").split(/\s+/).includes("maskable"))) add(manifestUrl, "icon-manifest", "warning", "the manifest has no maskable icon");
  for (const icon of icons) {
    const src = new URL(String(icon.src), manifestUrl).href;
    if (!isImage(await get(src))) add(src, "icon-broken", "error", "a manifest icon does not load");
  }
  return findings;
}
