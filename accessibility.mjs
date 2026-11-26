// The accessibility statement every public site serves at /accessibility, written once. The sections
// say that the site is built to be accessible and tested with screen-reader and keyboard tools, never that it fully
// meets a standard; then the measures taken, the known limitations, how to report a problem, and the date. The site passes its name, contact route and date, the
// open findings from the latest devkit-a11y report, and two facts about how it is built (whether its pages come from
// Capsomer, and how its links stand apart from text), so each sentence about the build is true of that site. It returns the page as Markdown (for a site that renders with its own
// pipeline) and as HTML (for a site with no Markdown pipeline); the site puts either in its own layout.

import { escapeHtml } from "@dustinedwards/site-runtime/html";

/** Where the statement lives. */
export const ACCESSIBILITY_PATH = /** @type {const} */ ("/accessibility");

/** The standard the network aims to meet. */
const ACCESSIBILITY_STANDARD = /** @type {const} */ ("WCAG 2.2 level AA");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * How links in running text stand apart from the words around them, one sentence per site setup. Each passes WCAG 2.2
 * SC 1.4.1 (Use of Color): F73 fails a link told apart by color alone and names an underline or bold as a cue that passes.
 */
const LINK_CUES = {
  marked:
    "Links never rely on color alone: each carries the link color and a heavier weight, and says when it leaves the site, opens a file, or sends mail.",
  underline:
    "Links never rely on color alone: each link in running text is underlined as well as colored.",
  bold: "Links never rely on color alone: each link in running text is set in a heavier weight than the words around it as well as colored.",
};

const CAPSOMER_MEASURE =
  "We build every page from Capsomer, an open-source design system. Its components are checked in a browser for keyboard use, focus, contrast, zoom and reflow, and for forced colors and right-to-left text.";

/** `2026-10-31` as "October 31, 2026", with no locale in the way. @param {string} day */
function longDate(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) throw new Error(`accessibilityStatement: date must be YYYY-MM-DD, got ${day}`);
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/**
 * @typedef {object} AccessibilityInput
 * @property {string} siteName The site's name as it reads in a sentence.
 * @property {{ href: string, label: string }} contact The site's own contact route, where a visitor reports a problem.
 * @property {string} date The day the statement was last checked, YYYY-MM-DD.
 * @property {boolean} capsomer Whether the site's pages are built from Capsomer's components; only then does the statement
 *   say so.
 * @property {"marked" | "underline" | "bold"} links How links in running text stand apart from the words around them, as the
 *   live site draws them: "marked" is Capsomer's link system (color, heavier weight, and marks for leaving the site, files and
 *   mail; needs `capsomer`), "underline" an underline with the color, "bold" a heavier weight with the color.
 * @property {string[]} [limitations] Open findings from the latest devkit-a11y report, one plain sentence each.
 * @property {string[]} [measures] Measures the site takes beyond the network's.
 */

/**
 * @typedef {object} AccessibilityStatement
 * @property {string} title
 * @property {string} description
 * @property {string} body Markdown, to render with the site's own pipeline.
 * @property {string} html The same sections as HTML (escaped, headings from h2), for a site with no Markdown pipeline.
 */

/**
 * The statement as Markdown (no top heading: the page's h1 is `title`), to render with the site's own pipeline.
 *
 * @param {AccessibilityInput} input
 * @returns {AccessibilityStatement}
 */
export function accessibilityStatement({
  siteName,
  contact,
  date,
  capsomer,
  links,
  limitations = [],
  measures = [],
}) {
  if (!siteName || !contact?.href || !contact.label)
    throw new Error("accessibilityStatement: siteName and contact { href, label } are required");
  if (typeof capsomer !== "boolean")
    throw new Error(
      "accessibilityStatement: capsomer must say whether the site's pages are built from Capsomer",
    );
  if (!Object.hasOwn(LINK_CUES, links))
    throw new Error(
      `accessibilityStatement: links must be one of ${Object.keys(LINK_CUES).join(", ")}, got ${links}`,
    );
  if (links === "marked" && !capsomer)
    throw new Error(
      'accessibilityStatement: links "marked" is Capsomer\'s link system, so it needs capsomer: true',
    );
  const standard = ACCESSIBILITY_STANDARD;
  const measuresTaken = [
    ...(capsomer ? [CAPSOMER_MEASURE] : []),
    "A live accessibility check loads this site's public pages in a real browser and reports what it finds.",
    LINK_CUES[links],
    ...measures,
  ];
  const intro = `${siteName} is built to be accessible and is tested with screen-reader and keyboard tools. We aim to meet ${standard}.`;
  const report = (/** @type {string} */ link) =>
    `If something doesn't work for you, tell us at ${link} and we'll fix it. Say which page and what you were trying to do.`;
  const reviewed = `This statement was last reviewed on ${longDate(date)}.`;
  const list = (/** @type {string[]} */ items) => items.map((item) => `- ${item}`).join("\n");
  const body = [
    intro,
    `## Measures we take\n\n${list(measuresTaken)}`,
    ...(limitations.length > 0 ? [`## Known limitations\n\n${list(limitations)}`] : []),
    `## Tell us about a problem\n\n${report(`[${contact.label}](${contact.href})`)}`,
    `## Date\n\n${reviewed}`,
  ].join("\n\n");
  const ul = (/** @type {string[]} */ items) =>
    `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    `<h2>Measures we take</h2>${ul(measuresTaken)}`,
    ...(limitations.length > 0 ? [`<h2>Known limitations</h2>${ul(limitations)}`] : []),
    `<h2>Tell us about a problem</h2><p>${report(`<a href="${escapeHtml(contact.href)}">${escapeHtml(contact.label)}</a>`)}</p>`,
    `<h2>Date</h2><p>${escapeHtml(reviewed)}</p>`,
  ].join("\n");
  return {
    title: "Accessibility statement",
    description: `How ${siteName} is built to be accessible, what is still open, and how to report a problem.`,
    body,
    html,
  };
}
