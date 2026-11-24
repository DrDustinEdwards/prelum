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
 * @property {"partial" | "full"} [conformance] "partial" (default) until the hand checks pass, then "full".
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
export function accessibilityStatement({ siteName, contact, date, capsomer, links, conformance, limitations, measures, }: AccessibilityInput): AccessibilityStatement;
/** Where the statement lives. */
export const ACCESSIBILITY_PATH: "/accessibility";
/** The standard the network holds its sites to. */
export const ACCESSIBILITY_STANDARD: "WCAG 2.2 level AA";
/**
 * What the checks leave open, true of every site: no screen reader has been run, and signed-in pages are not scanned.
 *
 * @type {string[]}
 */
export const HAND_CHECK_LIMITATIONS: string[];
export type AccessibilityInput = {
    /**
     * The site's name as it reads in a sentence.
     */
    siteName: string;
    /**
     * The site's own contact route, where a visitor reports a problem.
     */
    contact: {
        href: string;
        label: string;
    };
    /**
     * The day the statement was last checked, YYYY-MM-DD.
     */
    date: string;
    /**
     * Whether the site's pages are built from Capsomer's components; only then does the statement
     * say so.
     */
    capsomer: boolean;
    /**
     * How links in running text stand apart from the words around them, as the
     * live site draws them: "marked" is Capsomer's link system (color, heavier weight, and marks for leaving the site, files and
     * mail; needs `capsomer`), "underline" an underline with the color, "bold" a heavier weight with the color.
     */
    links: "marked" | "underline" | "bold";
    /**
     * "partial" (default) until the hand checks pass, then "full".
     */
    conformance?: "partial" | "full" | undefined;
    /**
     * Open findings from the latest devkit-a11y report, one plain sentence each.
     */
    limitations?: string[] | undefined;
    /**
     * Measures the site takes beyond the network's.
     */
    measures?: string[] | undefined;
};
export type AccessibilityStatement = {
    title: string;
    description: string;
    /**
     * Markdown, to render with the site's own pipeline.
     */
    body: string;
    /**
     * The same sections as HTML (escaped, headings from h2), for a site with no Markdown pipeline.
     */
    html: string;
};
