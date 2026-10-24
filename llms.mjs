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
  const blocks = [`# ${doc.title}`, `> ${doc.summary}`, ...(doc.intro ?? [])];
  for (const section of doc.sections) {
    if ("body" in section) {
      if (section.body.length > 0) blocks.push(`## ${section.heading}`, ...section.body);
    } else if (section.links.length > 0) {
      blocks.push(`## ${section.heading}\n${section.links.map(llmsLink).join("\n")}`);
    }
  }
  return `${blocks.join("\n\n")}\n`;
}

/** @param {LlmsLink} link */
export function llmsLink(link) {
  // One line per link: a newline in the title or description would end the list item, and a ")" in the URL would end the link.
  const oneLine = (/** @type {string} */ text) => text.replace(/\s*[\r\n]+\s*/g, " ");
  const title = oneLine(link.title).replace(/[[\]]/g, (bracket) => "\\" + bracket);
  const url = link.url.replace(/\)/g, "%29");
  return `- [${title}](${url})${link.description ? `: ${oneLine(link.description)}` : ""}`;
}
