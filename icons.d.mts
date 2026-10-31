import type { AuditFinding } from "./audit.mjs";

/**
 * The icon files every site serves, at the same paths everywhere: what Google's favicon rules, iOS and an installable web app
 * each ask for. `prelum-icons` draws them from one SVG.
 */
export declare const ICONS: {
  ico: "/favicon.ico";
  svg: "/icon.svg";
  apple: "/apple-touch-icon.png";
  any192: "/icon-192.png";
  any512: "/icon-512.png";
  maskable: "/icon-maskable-512.png";
  manifest: "/site.webmanifest";
};

/**
 * The `<link>`s for the icons, in the shape React Router's `links` export takes. `favicon.ico` holds 16, 32 and 48 pixel
 * images (Google wants a multiple of 48); the SVG is for browsers that draw it.
 */
export declare function iconLinks(): Array<{ rel: string; href: string; type?: string; sizes?: string }>;

export interface ManifestSite {
  name: string;
  shortName?: string;
  description?: string;
  themeColor: string;
  backgroundColor: string;
  startUrl?: string;
  display?: "standalone" | "minimal-ui" | "browser";
  lang?: string;
}

export interface ManifestIcon {
  src: string;
  sizes: string;
  type: "image/png";
  purpose: string;
}

/** The web app manifest, `site.webmanifest`, pointing at the icon files. */
export declare function webManifest(site: ManifestSite): {
  name: string;
  short_name: string;
  description?: string;
  lang?: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

/** An `.ico` file holding PNG images, one per size: the format browsers and Google read from `/favicon.ico`. */
export declare function icoFile(images: Array<{ size: number; png: Uint8Array }>): Uint8Array;

/**
 * The live check for a site's icons, the site-wide half of `prelum-audit`: `/favicon.ico` answers an image, the home page
 * links an icon, an Apple touch icon and a manifest, and the manifest names the site and an icon at 192 and 512 pixels and a
 * maskable one, each of which loads.
 */
export declare function auditIcons(site: { origin: string; fetch: typeof fetch }): Promise<AuditFinding[]>;
