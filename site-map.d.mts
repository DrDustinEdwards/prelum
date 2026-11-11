/** An item counted rather than listed: `to` is its index; `merge` puts the count on the index's own line. */
export type SiteMapTally = { key: string; label: string; to: string; merge: boolean };
/** One public URL, as the sitemap list holds it. */
export type SiteMapUrl = { path: string; title: string; tally?: SiteMapTally };
/** A section of the page: the address prefixes it owns (`roots`) and its hub (`to`). The last section is the catch-all. */
export type SiteMapSectionSpec = {
  id: string;
  heading: string;
  to: string | null;
  roots: readonly string[];
};
/** One line: a link by its title, or (`plain`) a count shown as text. */
export type SiteMapLine = { to: string; label: string; count?: number; plain?: boolean };
/** A section as the page draws it. */
export type SiteMapSection = {
  id: string;
  heading: string;
  to: string | null;
  lines: SiteMapLine[];
};
/** The id of the section a path belongs to: the first whose root it is under, else the last section. */
export function sectionOf(path: string, sections: ReadonlyArray<SiteMapSectionSpec>): string;
/** The page's sections from the URL list, each section's hub first; empty sections are left out. */
export function siteMapSections(
  urls: SiteMapUrl[],
  sections: ReadonlyArray<SiteMapSectionSpec>,
): SiteMapSection[];
/** A line's text: its label, with its count in brackets when it has one. */
export function lineText(line: { label: string; count?: number }): string;
