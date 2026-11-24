/**
 * Words as Unicode counts them (Intl.Segmenter), so "don't", "co-author" and a CJK sentence count the way a reader reads them, where a
 * whitespace split does not.
 *
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text: string): number;
/**
 * Minutes to read, never less than one: the words at WORDS_PER_MINUTE plus Medium's image time, 12 seconds for the first image and one
 * second less for each after it, down to 3. A site with its own published pace passes `wordsPerMinute`.
 *
 * @param {number} words
 * @param {number} [images]
 * @param {number} [wordsPerMinute]
 * @returns {number}
 */
export function readingMinutes(words: number, images?: number, wordsPerMinute?: number): number;
/**
 * Text cut to at most `max` characters at a word boundary, with an ellipsis when cut. Whitespace runs become one space.
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function excerpt(text: string, max?: number): string;
/**
 * The text of an HTML fragment (a rendered body, an abstract title): scripts and styles dropped, then tags, Prelum's own `#` heading
 * anchor links (navigation, not words), entities decoded and white space collapsed. An entity it does not know is kept as written.
 * The result is text, so it is escaped where it is written, as every tag is.
 *
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html: string): string;
/**
 * Seconds as an ISO 8601 duration (`PT1H2M3S`), the form schema.org's `duration` and `timeRequired` and a feed's `itunes:duration`
 * read; undefined for zero, negative or missing seconds, which would claim a length the media does not have.
 *
 * @param {number | null | undefined} totalSeconds
 * @returns {string | undefined}
 */
export function isoDuration(totalSeconds: number | null | undefined): string | undefined;
/**
 * True when `text` holds any wide dash, for a field check that needs a yes or no and not the places.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasWideDash(text: string): boolean;
/**
 * Server-side half of the no-em-dash rule: a save to the stored source never meets the local hook.
 *
 * @param {string} text
 * @returns {Array<{ line: number, column: number, char: string, excerpt: string }>}
 */
export function findWideDashes(text: string): Array<{
    line: number;
    column: number;
    char: string;
    excerpt: string;
}>;
/**
 * A count with its noun: `plural(1, "post")` is "1 post", `plural(3, "post")` "3 posts", and an irregular noun passes its
 * plural: `plural(2, "entry", "entries")`. A count is written with the locale's digits grouping ("1,204 posts") when
 * `grouped` is true.
 *
 * @param {number} count
 * @param {string} one
 * @param {string} [many] default `one` plus "s"
 * @param {{ grouped?: boolean }} [options]
 * @returns {string}
 */
export function plural(count: number, one: string, many?: string, { grouped }?: {
    grouped?: boolean;
}): string;
/**
 * A count as an American reader writes it: 1,204 (en-US grouping, so the server and every browser agree).
 *
 * @param {number} count
 * @returns {string}
 */
export function formatCount(count: number): string;
/**
 * The first character upper case and the rest as written: "monthly" becomes "Monthly", "" stays "".
 *
 * @param {string} text
 * @returns {string}
 */
export function capitalize(text: string): string;
/**
 * A slug or snake_case value as a title, every word capitalized: "payment-recovery" and "payment_recovery" both become
 * "Payment Recovery". Runs of `_`, `-` and spaces are one break, and an empty value stays "".
 *
 * @param {string} text
 * @returns {string}
 */
export function titleCase(text: string): string;
/**
 * A snake_case or slug value as a sentence, only its first word capitalized: "insufficient_funds" becomes
 * "Insufficient funds". Runs of `_`, `-` and spaces are one space, trimmed; an empty value stays "".
 *
 * @param {string} text
 * @returns {string}
 */
export function humanize(text: string): string;
/**
 * `#abc` or `#aabbcc` as lowercase `#aabbcc`. Surrounding space and a missing `#` are tolerated; anything else (an 8-digit hex with
 * alpha, a name) passes through lowercased, so a caller validates first.
 *
 * @param {string} hex
 * @returns {string}
 */
export function normalizeHex(hex: string): string;
/**
 * Line endings as LF: CRLF and lone CR (an old Mac file) both become `\n`, so a line count, a front matter split or a
 * comparison reads one file the same way from any editor.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text: string): string;
/**
 * A value made safe for one cell of a GFM table: a pipe is escaped (`\|`, which GFM reads as a literal pipe inside a cell) and a
 * line break becomes a space, since a cell cannot hold one. null and undefined are an empty cell.
 *
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function mdCell(value: string | number | null | undefined): string;
/**
 * Text made literal in Markdown: the characters CommonMark gives a meaning inline (backslash, backtick, `*`, `_`, brackets,
 * angle brackets, `#`, `|`) are backslash-escaped, and a colon before a letter too, since Prelum reads `:word` as a directive and
 * refuses one it does not know.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeMarkdown(text: string): string;
/** Silent reading speed for non-fiction in English, from Brysbaert's 2019 meta-analysis of 190 studies (238 words a minute). */
export const WORDS_PER_MINUTE: 238;
