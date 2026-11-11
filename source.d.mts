/** The chart types a `:::chart` block takes, with their labels. */
export const CHART_KINDS: readonly [
  { readonly value: "bar"; readonly label: "Bar" },
  { readonly value: "line"; readonly label: "Line" },
  { readonly value: "area"; readonly label: "Area" },
  { readonly value: "dot"; readonly label: "Dot" },
];
/** A chart type. */
export type ChartKind = (typeof CHART_KINDS)[number]["value"];
/** A CSV's column names, and which hold only numbers. */
export function csvColumns(csv: string): Array<{ name: string; numeric: boolean }>;
/** A `:::chart` block in Prelum's syntax; an empty title or caption is left out. */
export function chartBlock(fields: {
  type: string;
  x: string;
  y: readonly string[];
  title?: string;
  alt: string;
  caption?: string;
  csv: string;
}): string;
/** Each `:::chart` block in a body, with the line it starts on; code samples hold none. */
export function chartBlocks(body: string): Array<{ line: number; text: string }>;
/**
 * An image with its alt text and caption: a `:::figure` directive, or with `figure: false` plain Markdown. An empty alt (a
 * decorative image) is always plain `![""](url)`.
 */
export function figureMarkup(
  url: string,
  alt: string,
  options?: { caption?: string; figure?: boolean },
): string;
/** Each image in a source with no alt text: Markdown, `<img>` and `:::figure`, code skipped. */
export function imagesWithoutAlt(
  source: string,
): Array<{ excerpt: string; src: string; line: number }>;
/** A full https address with a host, as a canonical link must be. */
export function isAbsoluteHttps(value: string): boolean;
