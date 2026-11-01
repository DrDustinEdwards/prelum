/** Where the statement lives. */
export const ACCESSIBILITY_PATH: "/accessibility";
/** The standard the network holds its sites to. */
export const ACCESSIBILITY_STANDARD: "WCAG 2.2 level AA";
/** What no automatic check can settle, true of every site until its hand checks pass. */
export const HAND_CHECK_LIMITATIONS: string[];
/**
 * The statement as Markdown (no top heading: the page's h1 is `title`), to render with the site's own pipeline.
 *
 * @param {AccessibilityInput} input
 */
export function accessibilityStatement(input: AccessibilityInput): AccessibilityStatement;
export type AccessibilityInput = {
    /** The site's name as it reads in a sentence. */
    siteName: string;
    /** The site's own contact route, where a visitor reports a problem. */
    contact: { href: string; label: string };
    /** The day the statement was last checked, YYYY-MM-DD. */
    date: string;
    /** Whether the site's pages are built from Capsomer's components; only then does the statement say so. */
    capsomer: boolean;
    /**
     * How links in running text stand apart from the words around them, as the live site draws them: "marked" is
     * Capsomer's link system (color, heavier weight, and marks for leaving the site, files and mail; needs `capsomer`),
     * "underline" an underline with the color, "bold" a heavier weight with the color.
     */
    links: "marked" | "underline" | "bold";
    /** "partial" (default) until the hand checks pass, then "full". */
    conformance?: "partial" | "full";
    /** Open findings from the latest devkit-a11y report, one plain sentence each. */
    limitations?: string[];
    /** Measures the site takes beyond the network's. */
    measures?: string[];
};
export type AccessibilityStatement = {
    title: string;
    description: string;
    /** Markdown, to render with the site's own pipeline. */
    body: string;
    /** The same sections as HTML (escaped, headings from h2), for a site with no Markdown pipeline. */
    html: string;
};
