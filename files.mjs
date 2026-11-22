/**
 * The standard machine files every site answers, from one config, so no site writes their route glue: robots.txt,
 * ai.txt, site.webmanifest, the IndexNow key file and any search engine's ownership file. A Worker calls the handler
 * before React Router; null means the path is not one of them. llms.txt and the sitemap stay routes, since each site's
 * own content fills them (llmsResponse, sitemapResponse).
 *
 * Each file is the response its own helper writes (robotsResponse, aiTxtResponse, webManifestResponse, keyFileResponse,
 * verificationFileResponse), so its headers are the ones the network agreed on: a preview copy is `Disallow: /` and
 * no-store, ai.txt is noindex, every text file carries the TDM reservation.
 */
import { webManifestResponse } from "./icons.mjs";
import { keyFileResponse } from "./indexnow.mjs";
import { aiTxtResponse, robotsResponse, verificationFileResponse } from "./robots.mjs";

/**
 * @typedef {{ name: string, contact: string, policy?: string[] }} AiTxtSite
 * @typedef {object} StandardFiles
 * @property {string} origin The production origin: the Sitemap line, ai.txt's links, and what a request on another origin is a preview of.
 * @property {string[]} [disallow] What robots.txt and ai.txt both ask crawlers to leave alone.
 * @property {Partial<Omit<import("./robots.mjs").RobotsInput, "origin" | "disallow" | "preview">>} [robots] The rest of robots.txt's input (bots, sitemaps, notes, content signal).
 * @property {AiTxtSite | ((request: Request) => Promise<AiTxtSite>)} [ai] ai.txt's name and licensing contact, or a function reading them (from the site's content); no ai.txt without it.
 * @property {import("./icons.mjs").ManifestSite | ((request: Request) => Promise<import("./icons.mjs").ManifestSite>)} [manifest] site.webmanifest's fields (webManifest), or a function reading them (from the site's content); no manifest without it.
 * @property {string} [indexNowKey] The IndexNow key, served at `/<key>.txt`.
 * @property {Record<string, string>} [verification] Ownership files by exact path (`"/google0123abcd.html": "google-site-verification: google0123abcd.html"`).
 * @property {(request: Request) => boolean} [preview] Whether a request is a preview copy, for a site that knows better than the origin comparison (a Worker Preview).
 */

/**
 * The handler: the file's response, or null when the path is not a standard file.
 * @param {StandardFiles} config
 * @returns {(request: Request) => Promise<Response | null>}
 */
export function standardFiles({
  origin,
  disallow = [],
  robots = {},
  ai,
  manifest,
  indexNowKey,
  verification = {},
  preview,
}) {
  return async (request) => {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    const path = new URL(request.url).pathname;
    const plain = { origin, request, ...(preview ? { preview: preview(request) } : {}) };
    if (path === "/robots.txt") return robotsResponse({ ...robots, disallow, ...plain });
    if (path === "/ai.txt" && ai) {
      const who = typeof ai === "function" ? await ai(request) : ai;
      return aiTxtResponse({ ...who, disallow, ...plain });
    }
    if (path === "/site.webmanifest" && manifest)
      return webManifestResponse(
        typeof manifest === "function" ? await manifest(request) : manifest,
      );
    if (indexNowKey && path === `/${indexNowKey}.txt`)
      return keyFileResponse(indexNowKey, { "Cache-Control": "public, max-age=86400" });
    const file = Object.hasOwn(verification, path) ? verification[path] : undefined;
    if (file !== undefined) return verificationFileResponse(file);
    return null;
  };
}
