/** Silent reading speed for non-fiction in English, from Brysbaert's 2019 meta-analysis of 190 studies (238 words a minute). */
export const WORDS_PER_MINUTE: 238;
/** Words as Unicode counts them (Intl.Segmenter). */
export function wordCount(text: string): number;
/** Minutes to read, never less than one: words at WORDS_PER_MINUTE plus Medium's image time. */
export function readingMinutes(words: number, images?: number): number;
/** Text cut to at most `max` characters (default 160) at a word boundary, with an ellipsis when cut. */
export function excerpt(text: string, max?: number): string;
