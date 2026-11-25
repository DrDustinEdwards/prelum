/**
 * The HTML site map page, drawn from the same list of public URLs as
 * sitemap.xml, so the two cannot drift, and grouped by the site's own sections. Every page is one line by its title, except a
 * kind of page there are many of (papers, posts, tags), which is one line with its count, linking to its index.
 *
 * A Tally is an item counted rather than listed. `to` is its index; with `merge`, the count goes on the index's own line
 * ("Publications (36)"). Without it, the count is a line of its own in `to`'s section, as plain text ("Tags (34)"): the kind
 * has no index of its own, and a second link to `to` under another name would make two links with different text go to one
 * place (WCAG 2.4.4).
 */

/** @typedef {{ key: string, label: string, to: string, merge: boolean }} SiteMapTally An item counted rather than listed: `to` is its index; `merge` puts the count on the index's own line. */
/** @typedef {{ path: string, title: string, tally?: SiteMapTally }} SiteMapUrl One public URL, as the sitemap list holds it. */
/** @typedef {{ id: string, heading: string, to: string | null, roots: readonly string[] }} SiteMapSectionSpec A section of the page: the address prefixes it owns (`roots`) and its hub (`to`). The last section is the catch-all. */
/** @typedef {{ to: string, label: string, count?: number, plain?: boolean }} SiteMapLine One line: a link by its title, or (`plain`) a count shown as text. */
/** @typedef {{ id: string, heading: string, to: string | null, lines: SiteMapLine[] }} SiteMapSection A section as the page draws it. */

/** @param {string} path @param {string} root */
const under = (path, root) => path === root || path.startsWith(`${root}/`);

/**
 * The id of the section a path belongs to: the first section with a root the path is under, else the last section (the
 * catch-all, "Site").
 *
 * @param {string} path
 * @param {ReadonlyArray<SiteMapSectionSpec>} sections
 * @returns {string}
 */
export function sectionOf(path, sections) {
  const found = sections.find((section) => section.roots.some((root) => under(path, root)));
  return (found ?? sections[sections.length - 1])?.id ?? "";
}

/**
 * The page's sections from the URL list, in the order of `sections`. Lines keep the list's order, except that a section's
 * own hub (its `to`) comes first. A section with no line is left out.
 *
 * @param {SiteMapUrl[]} urls
 * @param {ReadonlyArray<SiteMapSectionSpec>} sections
 * @returns {SiteMapSection[]}
 */
export function siteMapSections(urls, sections) {
  /** @type {Map<string, { tally: SiteMapTally, count: number }>} */
  const tallies = new Map();
  /** @type {SiteMapLine[]} */
  const lines = [];
  for (const url of urls) {
    if (url.tally) {
      const seen = tallies.get(url.tally.key);
      if (seen) seen.count += 1;
      else tallies.set(url.tally.key, { tally: url.tally, count: 1 });
      continue;
    }
    lines.push({ to: url.path, label: url.title });
  }
  for (const { tally, count } of tallies.values()) {
    const index = tally.merge
      ? lines.find((line) => line.to === tally.to && line.count === undefined && !line.plain)
      : undefined;
    if (index) index.count = count;
    else
      lines.push({
        to: tally.to,
        label: tally.label,
        count,
        ...(tally.merge ? {} : { plain: true }),
      });
  }
  return sections
    .map(({ id, heading, to }) => {
      const own = lines.filter((line) => sectionOf(line.to, sections) === id);
      const isHub = (/** @type {{ to: string, plain?: boolean }} */ line) =>
        line.to === to && !line.plain;
      return {
        id,
        heading,
        to,
        lines: [...own.filter(isHub), ...own.filter((line) => !isHub(line))],
      };
    })
    .filter((section) => section.lines.length > 0);
}

/**
 * A line's text: its label, and its count in brackets when it has one.
 *
 * @param {{ label: string, count?: number }} line
 * @returns {string}
 */
export function lineText(line) {
  return line.count === undefined ? line.label : `${line.label} (${line.count})`;
}
