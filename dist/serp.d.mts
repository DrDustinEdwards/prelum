/** The width `text` draws at in Arial at `font` px, as Google's result shows it. */
export function serpWidth(text: string, font: number): number;
/**
 * Cut at a word boundary and mark the cut with "...", within `limit` in all: a width (`SERP_TITLE`, `SERP_DESCRIPTION`)
 * for what Google's result shows, or a number of characters for a field counted that way (X's image alt).
 *
 * @param {string} text
 * @param {number | { px: number, font: number }} limit
 */
export function truncateForSerp(text: string, limit: number | {
    px: number;
    font: number;
}): string;
/**
 * The `<title>` a search result shows: the title with the site's suffix where both fit, else the suffix dropped and the
 * title cut at a word. Only the `<title>` is shortened; pass the whole title as `socialTitle` and keep it in the heading.
 *
 * @param {string} title
 * @param {string} suffix e.g. " | Example Co"
 */
export function searchTitle(title: string, suffix: string): string;
/**
 * A meta tag's text from HTML (an excerpt, an abstract title): scripts, styles and tags dropped, entities decoded, white
 * space collapsed, then cut at a word to `limit` (by default `SERP_DESCRIPTION`'s width; a number is characters, and
 * `Infinity` keeps it whole). An
 * entity it does not know is kept as written. The result is text, so it is escaped where it is written, as every tag is.
 *
 * @param {string} html
 * @param {number | { px: number, font: number }} [limit]
 */
export function metaText(html: string, limit?: number | {
    px: number;
    font: number;
}): string;
/**
 * Google cuts a result's title and snippet by the width they draw at, not by a count of characters
 * (https://developers.google.com/search/docs/appearance/title-link: "titles are truncated ... to fit the device width"):
 * on a desktop result the title is 20 px Arial in a column about 600 px wide, the snippet 14 px Arial in about 920 px, the
 * measures SERP preview tools use. So the length is measured in pixels with Arial's widths (`serpWidth`): "about 60
 * characters" both flagged 62 narrow characters that fit and passed 55 wide ones that do not.
 */
export const SERP_TITLE: Readonly<{
    px: 600;
    font: 20;
}>;
export const SERP_DESCRIPTION: Readonly<{
    px: 920;
    font: 14;
}>;
