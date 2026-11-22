export function h(
  tagName: string,
  properties: Record<string, unknown>,
  children: unknown[],
): {
  type: string;
  tagName: string;
  properties: Record<string, unknown>;
  children: unknown[];
};
export function text(value: string): {
  type: string;
  value: string;
};
/**
 * HTML as a hast tree, read by htmlparser2, with each attribute mapped to its hast property (the SVG schema inside <svg>).
 */
export function fromHtml(html: string): import("hast").Root;
