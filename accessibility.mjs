// The accessibility statement every public site serves at /accessibility (devkit-a11y item S6), written once. The sections
// follow the W3C WAI statement generator: the commitment, the standard and how far the site meets it, the measures taken,
// the known limitations, how to report a problem, and the date. The site passes its name, contact route and date, the
// open findings from the latest devkit-a11y report, and two facts about how it is built (whether its pages come from
// Capsomer, and how its links stand apart from text), so each sentence about the build is true of that site. It returns the page as Markdown (for a site that renders with its own
// pipeline) and as HTML (for a site with no Markdown pipeline); the site puts either in its own layout.

/** Where the statement lives. */
export const ACCESSIBILITY_PATH = "/accessibility";

/** The standard the network holds its sites to. */
export const ACCESSIBILITY_STANDARD = "WCAG 2.2 level AA";

/** What no automatic check can settle, true of every site until its hand checks pass. */
export const HAND_CHECK_LIMITATIONS = [
  "We have not yet finished testing the key pages by hand with the NVDA and VoiceOver screen readers.",
  "Pages you reach only after signing in are checked by hand, not yet by the automatic scan.",
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * How links in running text stand apart from the words around them, one sentence per site setup. Each passes WCAG 2.2
 * SC 1.4.1 (Use of Color): F73 fails a link told apart by color alone and names an underline or bold as a cue that passes.
 */
const LINK_CUES = {
  marked:
    "Links never rely on color alone: each carries the link color and a heavier weight, and says when it leaves the site, opens a file, or sends mail.",
  underline: "Links never rely on color alone: each link in running text is underlined as well as colored.",
  bold: "Links never rely on color alone: each link in running text is set in a heavier weight than the words around it as well as colored.",
};

const CAPSOMER_MEASURE =
  "We build every page from Capsomer, the design system the sites of this network share. Its components are checked in a browser for keyboard use, focus, contrast, zoom and reflow, and for forced colors and right-to-left text.";

/** `2026-10-31` as "October 31, 2026", with no locale in the way. */
function longDate(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) throw new Error(`accessibilityStatement: date must be YYYY-MM-DD, got ${day}`);
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/** Text for an HTML element or a double-quoted attribute. */
function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * @param {import("./accessibility.d.mts").AccessibilityInput} input
 * @returns {import("./accessibility.d.mts").AccessibilityStatement}
 */
export function accessibilityStatement({ siteName, contact, date, capsomer, links, conformance = "partial", limitations = [], measures = [] }) {
  if (!siteName || !contact?.href || !contact.label) throw new Error("accessibilityStatement: siteName and contact { href, label } are required");
  if (typeof capsomer !== "boolean") throw new Error("accessibilityStatement: capsomer must say whether the site's pages are built from Capsomer");
  if (!Object.hasOwn(LINK_CUES, links)) throw new Error(`accessibilityStatement: links must be one of ${Object.keys(LINK_CUES).join(", ")}, got ${links}`);
  if (links === "marked" && !capsomer) throw new Error('accessibilityStatement: links "marked" is Capsomer\'s link system, so it needs capsomer: true');
  const standard = ACCESSIBILITY_STANDARD;
  const status =
    conformance === "full"
      ? `${siteName} conforms to ${standard}. Every page we have checked meets the standard.`
      : `${siteName} partially conforms to ${standard}. Partially conforms means some parts of the content do not yet fully meet the standard; the limitations below say which.`;
  const open = [...limitations, ...(conformance === "full" ? [] : HAND_CHECK_LIMITATIONS)];
  const measuresTaken = [
    ...(capsomer ? [CAPSOMER_MEASURE] : []),
    "A live accessibility check loads this site's public pages in a real browser and reports what it finds, which is where the known limitations below come from.",
    LINK_CUES[links],
    ...measures,
  ];
  const intro = `We want everyone to be able to use ${siteName}, including people who use a screen reader, a keyboard or voice control, or who need larger text or stronger contrast. We aim to meet ${standard}.`;
  const none = "We know of no limitations as of the date below.";
  const report = (link) =>
    `If something on this site is hard or impossible to use, tell us at ${link}. Say which page and what you were trying to do, and we will answer and fix it.`;
  const reviewed = `This statement was last reviewed on ${longDate(date)}.`;
  const list = (items) => items.map((item) => `- ${item}`).join("\n");
  const body = [
    intro,
    `## Conformance status\n\n${status}`,
    `## Measures we take\n\n${list(measuresTaken)}`,
    `## Known limitations\n\n${open.length > 0 ? list(open) : none}`,
    `## Tell us about a problem\n\n${report(`[${contact.label}](${contact.href})`)}`,
    `## Date\n\n${reviewed}`,
  ].join("\n\n");
  const ul = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
  const html = [
    `<p>${esc(intro)}</p>`,
    `<h2>Conformance status</h2><p>${esc(status)}</p>`,
    `<h2>Measures we take</h2>${ul(measuresTaken)}`,
    `<h2>Known limitations</h2>${open.length > 0 ? ul(open) : `<p>${none}</p>`}`,
    `<h2>Tell us about a problem</h2><p>${report(`<a href="${esc(contact.href)}">${esc(contact.label)}</a>`)}</p>`,
    `<h2>Date</h2><p>${esc(reviewed)}</p>`,
  ].join("\n");
  return {
    title: "Accessibility statement",
    description: `How ${siteName} meets ${standard}, where it falls short, and how to report a problem.`,
    body,
    html,
  };
}
