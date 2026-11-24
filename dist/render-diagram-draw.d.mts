/**
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colors one hex color per name in DIAGRAM_ROLE_NAMES
 * @returns {{ theme: string, themeVariables: Record<string, string | boolean>, htmlLabels: boolean,
 *   flowchart: { htmlLabels: boolean, padding: number, useMaxWidth: boolean }, sequence: Record<string, number | boolean> }}
 */
export function mermaidConfig(theme: "light" | "dark", colors: Record<string, string>): {
    theme: string;
    themeVariables: Record<string, string | boolean>;
    htmlLabels: boolean;
    flowchart: {
        htmlLabels: boolean;
        padding: number;
        useMaxWidth: boolean;
    };
    sequence: Record<string, number | boolean>;
};
/**
 * Draws what is missing (or everything, with `force`), audits each drawing before writing it, and deletes nothing: it
 * returns the files no diagram names, for the caller to prune by its own rules. The browser is only launched when there
 * is something to draw, so a build with every asset current needs no Chromium. PUPPETEER_EXECUTABLE_PATH points
 * Puppeteer at an installed Chromium; MERMAID_PUPPETEER_CONFIG is JSON launch options, for example
 * {"args":["--no-sandbox"]} in a container that runs as root.
 *
 * @param {{
 *   diagrams: Array<{ key: string, source: string, label?: string }>,
 *   dir: string,
 *   assetPrefix: string,
 *   colors: Record<"light" | "dark", Record<string, string>>,
 *   force?: boolean,
 *   log?: (line: string) => void,
 * }} options
 * @returns {Promise<{ written: string[], current: number, stale: string[], sizes: Record<string, { width: number, height: number }> }>}
 *   `sizes` is also written to DIAGRAM_SIZES_FILE in `dir`, for the site to pass to editorialPack's `diagramSizes`
 */
export function drawDiagrams({ diagrams, dir, assetPrefix, colors, force, log, }: {
    diagrams: Array<{
        key: string;
        source: string;
        label?: string;
    }>;
    dir: string;
    assetPrefix: string;
    colors: Record<"light" | "dark", Record<string, string>>;
    force?: boolean;
    log?: (line: string) => void;
}): Promise<{
    written: string[];
    current: number;
    stale: string[];
    sizes: Record<string, {
        width: number;
        height: number;
    }>;
}>;
/**
 * Deletes the named files from `dir`.
 *
 * @param {string} dir
 * @param {string[]} names
 */
export function pruneDiagrams(dir: string, names: string[]): Promise<void>;
/**
 * Every color a drawing can paint must be one of the palette's: in its `<style>` (rules inside conditional group rules
 * included, `@keyframes` audited whole, a rule no element matches skipped and counted), in `style` attributes, and in
 * presentation attributes no stylesheet rule overrides, on every element except unreferenced `<defs>` children.
 *
 * @param {string} svg
 * @param {string[]} paletteHexes
 * @returns {{ checked: number, skippedRules: number, overridden: number, problems: string[] }}
 */
export function auditDiagramSvg(svg: string, paletteHexes: string[]): {
    checked: number;
    skippedRules: number;
    overridden: number;
    problems: string[];
};
/**
 * Every Mermaid theme variable a diagram paints with, by the role its color plays. Everything khroma would otherwise
 * derive is supplied; what is not still gets derived, which is why every drawing is audited rather than trusting this
 * list to be complete.
 *
 * @type {Record<string, string>}
 */
export const DIAGRAM_ROLES: Record<string, string>;
/** The roles a site must color, each once per theme. */
export const DIAGRAM_ROLE_NAMES: string[];
