/**
 * @typedef {object} LlmsLink
 * @property {string} title
 * @property {string} url
 * @property {string} [description]
 */

/**
 * @typedef {object} LlmsLinkSection
 * @property {string} heading
 * @property {LlmsLink[]} links
 */

/**
 * @typedef {object} LlmsProseSection
 * @property {string} heading
 * @property {string[]} body paragraphs, kept as written and separated by a blank line
 */

/** @typedef {LlmsLinkSection | LlmsProseSection} LlmsSection */

/**
 * The llms.txt skeleton (llmstxt.org): title, a blockquote summary, optional intro paragraphs, then H2 sections of link lists.
 * A link's title is Markdown link text, so `[` and `]` are escaped; everything else is kept as written, because the titles are
 * prose and the sites' own files carry quotes and ampersands in them. A section with no links is dropped rather than left a
 * bare heading. A prose section (`body` in place of `links`) is its heading, a blank line, then its paragraphs as written, for a
 * file that mixes prose with its lists; one with no paragraphs is dropped the same way.
 *
 * @param {{ title: string, summary: string, intro?: string[], sections: LlmsSection[] }} doc
 * @returns {string}
 */
export function llmsDocument(doc) {
  const blocks = llmsHeader(doc);
  for (const section of doc.sections) {
    if ("body" in section) {
      if (section.body.length > 0) blocks.push(`## ${section.heading}`, ...section.body);
    } else if (section.links.length > 0) {
      blocks.push(`## ${section.heading}\n${section.links.map(llmsLink).join("\n")}`);
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

/** The title, summary and intro llms.txt and llms-full.txt both open with. @param {{ title: string, summary: string, intro?: string[] }} doc */
function llmsHeader(doc) {
  return [`# ${doc.title}`, `> ${doc.summary}`, ...(doc.intro ?? [])];
}

/** A line break becomes a space. @param {string} text */
const oneLine = (text) => text.replace(/\s*[\r\n]+\s*/g, " ");

/** @param {LlmsLink} link */
export function llmsLink(link) {
  // One line per link: a newline in the title or description would end the list item, and a ")" in the URL would end the link.
  const title = oneLine(link.title).replace(/[[\]]/g, (bracket) => "\\" + bracket);
  const url = link.url.replace(/\)/g, "%29");
  return `- [${title}](${url})${link.description ? `: ${oneLine(link.description)}` : ""}`;
}

/*
 * llms-full.txt and the Markdown copy of each page, after Cloudflare's Nimbus (https://github.com/cloudflare/nimbus,
 * packages/nimbus-docs/src/_internal/llms-full.ts and markdown-negotiation.ts). `prefersMarkdown` is Nimbus's code; the rest
 * follows its format. Nimbus is MIT licensed:
 *
 *   MIT License Copyright (c) 2025 Cloudflare, Inc.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
 *   files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
 *   modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 *   Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 *   WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 *   COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 *   ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * @typedef {object} LlmsPage
 * @property {string} title
 * @property {string} url the page's absolute URL
 * @property {string} [description]
 * @property {string} markdown the page's body as Markdown, frontmatter already stripped; its headings start at `##`
 */

/**
 * One page as Markdown: its title as the `#` heading, the description as a blockquote, the page's URL, then the body. The
 * same text is the page's `.md` copy and its part of llms-full.txt, so the two cannot disagree. A line break in the title or
 * description becomes a space, so neither can end its line early.
 *
 * @param {LlmsPage} page
 * @returns {string}
 */
export function markdownPage(page) {
  const blocks = [`# ${oneLine(page.title)}`];
  if (page.description) blocks.push(`> ${oneLine(page.description)}`);
  blocks.push(`Source: ${page.url}`);
  if (page.markdown.trim()) blocks.push(page.markdown.trim());
  return `${blocks.join("\n\n")}\n`;
}

/**
 * llms-full.txt (llmstxt.org): the same title, summary and intro as llms.txt, then every page in full, each as `markdownPage`
 * writes it. Pages keep the caller's order, so the file is byte for byte the same on every build of the same pages.
 *
 * @param {{ title: string, summary: string, intro?: string[], pages: LlmsPage[] }} doc
 * @returns {string}
 */
export function llmsFullDocument(doc) {
  return [`${llmsHeader(doc).join("\n\n")}\n`, ...doc.pages.map(markdownPage)].join("\n");
}

/**
 * Where a page's Markdown copy lives: `/writing/post` is `/writing/post.md`, and the home page is `/index.md`.
 *
 * @param {string} path
 */
export function markdownPath(path) {
  const bare = path.replace(/\/+$/, "");
  return bare ? `${bare}.md` : "/index.md";
}

/**
 * Whether a request's Accept header prefers Markdown over HTML (RFC 9110). Markdown wins only when `text/markdown` is
 * acceptable and outranks every HTML and wildcard range; a tie or an unreadable header keeps HTML, so a browser never gets
 * Markdown by accident. Nimbus's `prefersMarkdown`.
 *
 * @param {string | null | undefined} accept
 * @returns {boolean}
 */
export function prefersMarkdown(accept) {
  if (!accept) return false;
  let markdown = 0;
  let html = 0;
  for (const range of accept.split(",")) {
    const [rawType = "", ...params] = range.toLowerCase().split(";");
    const type = rawType.trim();
    if (!/^[\w.+-]+\/[\w.+*-]+$|^\*\/\*$/.test(type)) continue;
    const q = params
      .map((param) => param.trim())
      .find((param) => /^q\s*=/.test(param))
      ?.replace(/^q\s*=\s*/, "");
    if (q !== undefined && !/^(0(\.\d{0,3})?|1(\.0{0,3})?)$/.test(q)) return false;
    const weight = q === undefined ? 1 : Number(q);
    if (type === "text/markdown") markdown = Math.max(markdown, weight);
    else if (type === "text/html" || type === "text/*" || type === "*/*") html = Math.max(html, weight);
  }
  return markdown > 0 && markdown > html;
}

/**
 * The response for a page's Markdown copy, from its `.md` route or from the page's own route when `prefersMarkdown` is true.
 * `Vary: Accept` tells a cache the page's URL has two forms; the page's HTML response needs it too. With `canonical`, a
 * `Link: rel="canonical"` header points search engines at the HTML page, so the copy never competes with it.
 *
 * @param {string} markdown what `markdownPage` wrote
 * @param {{ canonical?: string, headers?: Record<string, string> }} [options] `headers` are added, e.g. the site's cache policy
 * @returns {Response}
 */
export function markdownResponse(markdown, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Vary", "Accept");
  if (options.canonical) headers.set("Link", `<${options.canonical}>; rel="canonical"`);
  return new Response(markdown, { headers });
}
