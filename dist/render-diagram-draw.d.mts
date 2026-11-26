/**
 * Draws what is missing (or everything, with `force`), audits each drawing before writing it, and deletes nothing: it
 * returns the files no diagram names, for the caller to prune by its own rules. The browser is only launched when there
 * is something to draw. PUPPETEER_EXECUTABLE_PATH points Puppeteer at an installed Chromium; MERMAID_PUPPETEER_CONFIG is JSON
 * launch options, for example {"args":["--no-sandbox"]} in a container that runs as root.
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
/** The roles a site must color, each once per theme. */
export const DIAGRAM_ROLE_NAMES: string[];
