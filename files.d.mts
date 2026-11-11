import type { ManifestSite } from "./icons.mjs";
import type { RobotsInput } from "./robots.mjs";

export interface StandardFiles {
  /** The production origin: the Sitemap line, ai.txt's links, and what a request on another origin is a preview of. */
  origin: string;
  /** What robots.txt and ai.txt both ask crawlers to leave alone. */
  disallow?: string[];
  /** The rest of robots.txt's input (bots, sitemaps, notes, content signal). */
  robots?: Partial<Omit<RobotsInput, "origin" | "disallow" | "preview">>;
  /** ai.txt's name and licensing contact, or a function reading them (from the site's content); no ai.txt without it. */
  ai?:
    | { name: string; contact: string; policy?: string[] }
    | ((request: Request) => Promise<{ name: string; contact: string; policy?: string[] }>);
  /** site.webmanifest's fields (webManifest); no manifest without it. */
  manifest?: ManifestSite;
  /** The IndexNow key, served at `/<key>.txt`. */
  indexNowKey?: string;
  /** Ownership files by exact path (`"/google0123abcd.html": "google-site-verification: google0123abcd.html"`). */
  verification?: Record<string, string>;
  /** Whether a request is a preview copy, for a site that knows better than the origin comparison (a Worker Preview). */
  preview?: (request: Request) => boolean;
}

/** The handler: the file's response, or null when the path is not a standard file. */
export function standardFiles(
  config: StandardFiles,
): (request: Request) => Promise<Response | null>;
