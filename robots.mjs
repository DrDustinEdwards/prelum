/**
 * The family's crawler policy (Dustin, 2026-10-25): search engines and the bots that put a page in an AI answer with a link
 * are always allowed; training crawlers are allowed here so they reach Cloudflare's Pay Per Crawl price, where AI Crawl
 * Control charges or blocks them; Bytespider is denied, since it ignores payment requests and has no answer surface.
 */
export const SEARCH_ENGINE_BOTS = ["Googlebot", "Bingbot", "DuckDuckBot", "Applebot"];
export const AI_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];
export const AI_TRAINING_BOTS = ["GPTBot", "ClaudeBot", "anthropic-ai", "CCBot", "Google-Extended", "Applebot-Extended"];
export const DENIED_BOTS = ["Bytespider"];

/**
 * @typedef {object} RobotsInput
 * @property {string} origin the production origin, for the Sitemap line
 * @property {string[]} [disallow] paths no crawler is asked to fetch (admin, previews, billed endpoints)
 * @property {string[]} [allowBots] named groups; defaults to the search engines, the AI search bots and the training bots
 * @property {string[]} [denyBots] defaults to `DENIED_BOTS`
 * @property {string[]} [sitemaps] defaults to `${origin}/sitemap.xml`
 * @property {string[]} [notes] lines after the Sitemap lines, each written as a `#` comment (an llms.txt pointer, say)
 * @property {boolean} [preview] a preview or workers.dev copy: every crawler is told `Disallow: /`
 */

/**
 * robots.txt. Every named group repeats the full disallow list: a crawler that matches a named group uses only that group
 * (RFC 9309 2.2.1, and Google's documentation: groups are not combined), so a named group with a bare `Allow: /` would open
 * every path the wildcard excludes. Advisory only; the real controls stay in the site (noindex headers, POST-only routes).
 *
 * @param {RobotsInput} input
 * @returns {string}
 */
export function robotsDocument(input) {
  if (input.preview) return "User-agent: *\nDisallow: /\n";
  const {
    origin,
    disallow = [],
    allowBots = [...SEARCH_ENGINE_BOTS, ...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS],
    denyBots = DENIED_BOTS,
    sitemaps = [`${origin}/sitemap.xml`],
    notes = [],
  } = input;
  const group = (/** @type {string} */ agent) => [
    `User-agent: ${agent}`,
    "Allow: /",
    ...disallow.map((path) => `Disallow: ${path}`),
    "",
  ];
  return [
    ...group("*"),
    ...allowBots.flatMap(group),
    ...denyBots.flatMap((agent) => [`User-agent: ${agent}`, "Disallow: /", ""]),
    ...sitemaps.map((url) => `Sitemap: ${url}`),
    ...notes.map((note) => `# ${note}`),
    "",
  ].join("\n");
}

/**
 * The TDM Reservation Protocol header (W3C TDMRep): text and data mining rights are reserved, the EU DSM Article 4 opt-out,
 * which is what lets a training crawler be charged rather than mine for free. Every public response carries it. There is no
 * `tdm-policy`: TDMRep reads one only as ODRL JSON or an HTML page, and a plain-text ai.txt is neither.
 */
export const TDM_RESERVATION_HEADERS = { "tdm-reservation": "1" };

/**
 * @typedef {object} AiTxtInput
 * @property {string} origin the production origin
 * @property {string} name the site's name
 * @property {string} contact where a licensing request goes, an email address
 * @property {string[]} [disallow] the same list robots.txt carries
 * @property {string[]} [policy] the site's own wording of the policy, in place of the family's; a line not already a `#`
 *   comment is written as one, so edited text cannot turn into a directive
 */

/**
 * ai.txt, the family's AI usage policy in the robots.txt form: answer engines may cite and link, training rights are
 * reserved (as `TDM_RESERVATION_HEADERS` says) and licensed on request.
 *
 * @param {AiTxtInput} input
 * @returns {string}
 */
export function aiTxt({ origin, name, contact, disallow = [], policy }) {
  const wording = policy ?? [
    "Citation and search (answer engines, retrieval): allowed. Please cite the page and link its canonical URL.",
    "Training data: rights reserved (TDMRep tdm-reservation: 1). Ask for a license at the address below.",
  ];
  return [
    `# ai.txt: AI usage policy for ${name} (${origin})`,
    "# The same policy as /robots.txt and the TDMRep tdm-reservation header.",
    "",
    ...wording.map((line) => (line.startsWith("#") ? line : `# ${line}`.trimEnd())),
    "",
    "User-agent: *",
    "Allow: /",
    ...disallow.map((path) => `Disallow: ${path}`),
    "",
    "# Training data: rights reserved. Licensing:",
    `# ${contact}`,
    "Training: disallow",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Content-index: ${origin}/llms.txt`,
    "",
  ].join("\n");
}

/**
 * How long a shared cache keeps robots.txt, ai.txt and llms.txt: an hour, the lifetime most of the sites chose, so a policy
 * change reaches crawlers the same day everywhere.
 */
export const PLAIN_TEXT_CACHE_CONTROL = "public, max-age=3600";

/**
 * @typedef {object} PlainTextOptions
 * @property {string} origin the site's production origin
 * @property {Request} request the request being answered: its origin differing from `origin` marks a preview
 * @property {boolean} [preview] in place of the origin comparison, for a site that knows otherwise (a Worker Preview's env var)
 * @property {Record<string, string>} [headers] added last, so a site can add a `Cache-Tag` or replace the cache lifetime
 */

/**
 * Whether a request reached a copy of the site that is not the production origin (a workers.dev URL, a Worker Preview): the
 * copy must not be crawled or indexed in place of the site.
 *
 * @param {Pick<PlainTextOptions, "origin" | "request" | "preview">} options
 */
export function isPreviewRequest({ origin, request, preview }) {
  if (preview !== undefined) return preview;
  return new URL(request.url).origin !== new URL(origin).origin;
}

/**
 * The one set of headers the family's plain-text policy files carry: UTF-8 text, `PLAIN_TEXT_CACHE_CONTROL` (or `no-store`
 * on a preview, which no cache should keep), `TDM_RESERVATION_HEADERS`, and `X-Robots-Tag: noindex` where the file is for
 * machines and should not appear in search results.
 *
 * @param {string} body
 * @param {PlainTextOptions & { noindex?: boolean }} options
 * @returns {Response}
 */
export function plainTextResponse(body, options) {
  const preview = isPreviewRequest(options);
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": preview ? "no-store" : PLAIN_TEXT_CACHE_CONTROL,
    ...TDM_RESERVATION_HEADERS,
  });
  if (options.noindex || preview) headers.set("X-Robots-Tag", "noindex");
  for (const [name, value] of Object.entries(options.headers ?? {})) headers.set(name, value);
  return new Response(body, { headers });
}

/**
 * The default `#` notes robots.txt ends with: where the AI usage policy and the LLM guide live.
 *
 * @param {string} origin
 */
export function robotsNotes(origin) {
  const base = origin.replace(/\/$/, "");
  return [`AI usage policy: ${base}/ai.txt`, `LLM guide: ${base}/llms.txt`];
}

/**
 * /robots.txt as a whole response, the route every site wrote: `robotsDocument` with `robotsNotes(origin)` as the notes unless
 * the site passes its own, `Disallow: /` for every crawler when the request is a preview, and `plainTextResponse`'s headers.
 *
 * @param {Omit<RobotsInput, "preview"> & PlainTextOptions} input
 * @returns {Response}
 */
export function robotsResponse(input) {
  const body = robotsDocument({ ...input, notes: input.notes ?? robotsNotes(input.origin), preview: isPreviewRequest(input) });
  return plainTextResponse(body, input);
}

/**
 * /ai.txt as a whole response: `aiTxt`, with `plainTextResponse`'s headers and `X-Robots-Tag: noindex`, since the file is
 * policy for machines, not a page for search results.
 *
 * @param {AiTxtInput & PlainTextOptions} input
 * @returns {Response}
 */
export function aiTxtResponse(input) {
  return plainTextResponse(aiTxt(input), { ...input, noindex: true });
}
