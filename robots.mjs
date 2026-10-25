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
