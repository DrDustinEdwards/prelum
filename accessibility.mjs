// The accessibility statement every public site serves at /accessibility (devkit-a11y item S6), written once. The sections
// follow the W3C WAI statement generator: the commitment, the standard and how far the site meets it, the measures taken,
// the known limitations, how to report a problem, and the date. The site passes its name, contact route and date, and the
// open findings from the latest devkit-a11y report; the page is Markdown, rendered by the site's own pipeline in its own layout.

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

/** `2026-10-31` as "October 31, 2026", with no locale in the way. */
function longDate(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  if (!m || !month) throw new Error(`accessibilityStatement: date must be YYYY-MM-DD, got ${day}`);
  return `${month} ${Number(m[3])}, ${m[1]}`;
}

/**
 * @param {import("./accessibility.d.mts").AccessibilityInput} input
 * @returns {import("./accessibility.d.mts").AccessibilityStatement}
 */
export function accessibilityStatement({ siteName, contact, date, conformance = "partial", limitations = [], measures = [] }) {
  if (!siteName || !contact?.href || !contact.label) throw new Error("accessibilityStatement: siteName and contact { href, label } are required");
  const standard = ACCESSIBILITY_STANDARD;
  const status =
    conformance === "full"
      ? `${siteName} conforms to ${standard}. Every page we have checked meets the standard.`
      : `${siteName} partially conforms to ${standard}. Partially conforms means some parts of the content do not yet fully meet the standard; the limitations below say which.`;
  const open = [...limitations, ...(conformance === "full" ? [] : HAND_CHECK_LIMITATIONS)];
  const known = open.length > 0 ? open.map((item) => `- ${item}`).join("\n") : "We know of no limitations as of the date below.";
  const measuresTaken = [
    "We build every page from Capsomer, the design system the sites of this network share. Its components are checked in a browser for keyboard use, focus, contrast, zoom and reflow, and for forced colors and right-to-left text.",
    "A live accessibility check loads this site's public pages in a real browser and reports what it finds, which is where the known limitations below come from.",
    "Links never rely on color alone: each carries the link color and a heavier weight, and says when it leaves the site, opens a file, or sends mail.",
    ...measures,
  ]
    .map((item) => `- ${item}`)
    .join("\n");
  const body = [
    `We want everyone to be able to use ${siteName}, including people who use a screen reader, a keyboard or voice control, or who need larger text or stronger contrast. We aim to meet ${standard}.`,
    `## Conformance status\n\n${status}`,
    `## Measures we take\n\n${measuresTaken}`,
    `## Known limitations\n\n${known}`,
    `## Tell us about a problem\n\nIf something on this site is hard or impossible to use, tell us at [${contact.label}](${contact.href}). Say which page and what you were trying to do, and we will answer and fix it.`,
    `## Date\n\nThis statement was last reviewed on ${longDate(date)}.`,
  ].join("\n\n");
  return {
    title: "Accessibility statement",
    description: `How ${siteName} meets ${standard}, where it falls short, and how to report a problem.`,
    body,
  };
}
