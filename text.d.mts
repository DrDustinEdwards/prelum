/** Silent reading speed for non-fiction in English, from Brysbaert's 2019 meta-analysis of 190 studies (238 words a minute). */
export const WORDS_PER_MINUTE: 238;
/** Words as Unicode counts them (Intl.Segmenter). */
export function wordCount(text: string): number;
/** Minutes to read, never less than one: words at WORDS_PER_MINUTE plus Medium's image time. */
export function readingMinutes(words: number, images?: number): number;
/** Text cut to at most `max` characters (default 160) at a word boundary, with an ellipsis when cut. */
export function excerpt(text: string, max?: number): string;
/** The text of an HTML fragment: scripts, styles, tags and Prelum's `#` heading anchors dropped, entities decoded, white space collapsed. */
export function htmlToText(html: string): string;
/** Seconds as an ISO 8601 duration (`PT1H2M3S`); undefined for zero, negative or missing seconds. */
export function isoDuration(totalSeconds: number | null | undefined): string | undefined;
/** Every wide dash (U+2010 to U+2015, U+2212) in `text`, with its 1-based line and column, code point and context. */
export function findWideDashes(
  text: string,
): Array<{ line: number; column: number; char: string; excerpt: string }>;
