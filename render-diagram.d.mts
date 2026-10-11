/**
 * FNV-1a, 32 bits, over UTF-16 code units: a short stable fingerprint, not a security boundary.
 *
 * @param {string} input
 * @returns {string} eight lowercase hex digits
 */
export function fnv1a32(input: string): string;
/**
 * Posts check out as LF and the rest of the tree as CRLF; without this, clones on different OSes
 * compute different keys for the same diagram.
 *
 * @param {string} source
 */
export function normalizeDiagramSource(source: string): string;
/**
 * @param {string} source the mermaid source, unnormalised
 */
export function diagramKey(source: string): string;
/**
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 * @param {string} assetPrefix the site's asset name prefix, for example "dustin-edwards-"
 */
export function diagramAssetPath(key: string, theme: string, assetPrefix: string): string;
/**
 * @param {Record<string, string>} attrs
 * @param {string} source the fenced mermaid block's contents
 */
export function buildDiagramModel(attrs: Record<string, string>, source: string): {
    alt: string;
    title: string;
    source: string;
    key: string;
};
export const DIAGRAM_ASSET_DIR: "diagrams";
export const DIAGRAM_THEMES: string[];
export function renderDiagramHast(assetPrefix: string): (model: ReturnType<typeof buildDiagramModel>, captionChildren: any[]) => any[];
