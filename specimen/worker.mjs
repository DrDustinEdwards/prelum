// The specimen's Worker: sends plain HTTP to HTTPS and serves everything else from the static assets in specimen/dist. It runs in
// front of the assets (run_worker_first) so it sees http: requests, which the assets layer would otherwise answer directly, as
// Enarratio's gallery does (enarratio worker/index.ts). Nothing else lives here.

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch(request: Request): Promise<Response> } }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
