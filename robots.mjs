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
