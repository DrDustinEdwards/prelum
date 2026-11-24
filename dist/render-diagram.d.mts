/**
 * @param {string} key
 * @param {string} theme one of DIAGRAM_THEMES
 * @param {string} assetPrefix the site's asset name prefix, for example "example-"
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
/**
 * A drawing's size from the site's sizes file, or null when it is not drawn yet.
 *
 * @param {Record<string, { width: number, height: number }>} sizes
 * @param {string} src the asset path diagramAssetPath gives
 */
export function diagramSize(sizes: Record<string, {
    width: number;
    height: number;
}>, src: string): {
    width: number;
    height: number;
} | null;
export const DIAGRAM_ASSET_DIR: "diagrams";
export const DIAGRAM_THEMES: string[];
/** The file drawDiagrams writes beside the drawings: each drawing's width and height, by file name, for the renderer to size it. */
export const DIAGRAM_SIZES_FILE: "sizes.json";
export function renderDiagramHast(assetPrefix: string, sizes?: Record<string, {
    width: number;
    height: number;
}>): (model: ReturnType<typeof buildDiagramModel>, captionChildren: import("hast").ElementContent[]) => import("hast").ElementContent[];
