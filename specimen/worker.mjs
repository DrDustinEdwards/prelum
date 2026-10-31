// The specimen's Worker: sends plain HTTP to HTTPS, receives Content-Security-Policy violation reports at /csp-report with
// site-runtime's shared receiver (logged to Workers Logs, nothing stored), and serves everything else from the static assets in
// specimen/dist. It runs in front of the assets (run_worker_first) so it sees http: requests, which the assets layer would
// otherwise answer directly, as Enarratio's gallery does (enarratio worker/index.ts). site-runtime is a devDependency: the
// published library never imports this file.

import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { REPORT_PATH, SITE_HEADERS as HEADERS } from "./headers.mjs";


export default {
  /**
   * @param {Request} request
   * @param {{
   *   ASSETS: { fetch(request: Request): Promise<Response> },
   *   CSP_REPORT_RATE_LIMIT: { limit(options: { key: string }): Promise<{ success: boolean }> },
   * }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      // Built by hand rather than with Response.redirect, so the 301 carries the same locked-down headers as the static files (specimen/headers.mjs).
      return new Response(null, { status: 301, headers: { ...HEADERS, Location: url.toString() } });
    }
    if (url.pathname === REPORT_PATH) {
      // The rate-limit binding in wrangler.jsonc, keyed by the client address, which is counted at the edge and never logged.
      const allow = async (/** @type {Request} */ r) =>
        (await env.CSP_REPORT_RATE_LIMIT.limit({ key: r.headers.get("CF-Connecting-IP") ?? "unknown" })).success;
      return receiveCspReport(request, { headers: HEADERS, allow });
    }
    return env.ASSETS.fetch(request);
  },
};
