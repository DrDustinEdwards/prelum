/** Every Mermaid theme variable a diagram paints with, by the role its colour plays. */
export const DIAGRAM_ROLES: Record<string, string>;
/** The roles a site must colour, each once per theme. */
export const DIAGRAM_ROLE_NAMES: string[];
/**
 * @param {"light" | "dark"} theme
 * @param {Record<string, string>} colours one hex colour per name in DIAGRAM_ROLE_NAMES
 */
export function mermaidConfig(theme: "light" | "dark", colours: Record<string, string>): {
    theme: string;
    themeVariables: Record<string, string | boolean>;
    htmlLabels: boolean;
    flowchart: { htmlLabels: boolean; padding: number; useMaxWidth: boolean };
    sequence: Record<string, number | boolean>;
};
/**
 * Draws what is missing (or everything, with `force`), audits each drawing before writing it, and returns the files no
 * diagram names, for the caller to prune.
 */
export function drawDiagrams(options: {
    diagrams: Array<{ key: string; source: string; label?: string }>;
    dir: string;
    assetPrefix: string;
    colours: Record<"light" | "dark", Record<string, string>>;
    force?: boolean;
    log?: (line: string) => void;
}): Promise<{ written: string[]; current: number; stale: string[] }>;
/** Deletes the named files from `dir`. */
export function pruneDiagrams(dir: string, names: string[]): Promise<void>;
/** Every colour a drawing can paint must be one of the palette's. */
export function auditDiagramSvg(svg: string, paletteHexes: string[]): {
    checked: number;
    skippedRules: number;
    overridden: number;
    problems: string[];
};
