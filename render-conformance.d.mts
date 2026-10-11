/**
 * Renders every hostile input with the caller's own configured renderer and scans what comes out.
 *
 * @param {(source: string) => Promise<{ html: string }>} renderSource the site's renderer, configured as the site configures it
 * @param {import("./render-safe.mjs").Allowlist} [allowlist]
 * @returns {Promise<{
 *   inputs: number,
 *   rendered: number,
 *   refused: string[],
 *   elements: number,
 *   attributes: number,
 *   violations: Array<{ input: string, kind: string, tag: string, attribute?: string }>,
 * }>}
 */
export function runConformance(renderSource: (source: string) => Promise<{
    html: string;
}>, allowlist?: import("./render-safe.mjs").Allowlist): Promise<{
    inputs: number;
    rendered: number;
    refused: string[];
    elements: number;
    attributes: number;
    violations: Array<{
        input: string;
        kind: string;
        tag: string;
        attribute?: string;
    }>;
}>;
/** @type {ReadonlyArray<{ name: string, source: string }>} */
export const HOSTILE_INPUTS: ReadonlyArray<{
    name: string;
    source: string;
}>;
