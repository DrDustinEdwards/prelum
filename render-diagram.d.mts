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
