/**
 * The cues of a WebVTT file, in order, as a viewer reads them: the identifier, NOTE, STYLE and REGION blocks and the cue
 * settings left out, the markup (`<i>`, `<c.class>`, `<00:01.000>` timestamps) dropped from the text and the voice's name kept
 * as `speaker`. A cue with no text, or a timing line that is not valid WebVTT, is skipped. A byte order mark and any line
 * ending (CRLF, LF or CR) are accepted.
 *
 * @param {string | null | undefined} vtt
 * @returns {Cue[]}
 */
export function parseVtt(vtt: string | null | undefined): Cue[];
/**
 * The cues' text as running text, one space between cues, for a model or a search that reads the words and not the timing.
 *
 * @param {readonly Cue[]} cues
 * @returns {string}
 */
export function transcriptText(cues: readonly Cue[]): string;
/**
 * The time the last cue ends, in seconds: the transcript's length as far as the cues say. Zero with no cues.
 *
 * @param {readonly Cue[]} cues
 * @returns {number}
 */
export function transcriptDuration(cues: readonly Cue[]): number;
/**
 * True for text that starts as WebVTT must: an optional byte order mark, then `WEBVTT` followed by the end of the text, a
 * space, a tab or a line ending.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isVtt(text: string): boolean;
/**
 * Caption-style cues grouped into readable paragraphs, each cue keeping its own timing. A paragraph ends at a sentence's end
 * once it holds `minWords` words, or at a silence longer than `gap` seconds.
 *
 * @param {readonly Cue[]} cues
 * @param {{ minWords?: number, gap?: number }} [options] 45 words and 2.5 seconds by default
 * @returns {Cue[][]}
 */
export function toParagraphs(cues: readonly Cue[], { minWords, gap }?: {
    minWords?: number;
    gap?: number;
}): Cue[][];
/**
 * SubRip (SRT) as WebVTT: the header added, the cue numbers dropped and the comma in each timestamp made the dot WebVTT
 * requires.
 *
 * @param {string} srt
 * @returns {string}
 */
export function srtToVtt(srt: string): string;
/**
 * A cue's text split into a speaker label, the spoken words, and whether it is a non-verbal cue such as `[MUSIC]` or
 * `(laughs)`. The speaker is a `Name: ` prefix, which some exporters leave where a `<v Name>` tag was; `parseVtt`'s own
 * `speaker` is the tag.
 *
 * @param {string | null | undefined} raw
 * @returns {{ speaker: string | null, text: string, nonVerbal: boolean }}
 */
export function parseCueText(raw: string | null | undefined): {
    speaker: string | null;
    text: string;
    nonVerbal: boolean;
};
export type Cue = {
    /**
     * seconds
     */
    start: number;
    /**
     * seconds
     */
    end: number;
    /**
     * the spoken text on one line, tags dropped and the format's character references decoded
     */
    text: string;
    /**
     * the name in a `<v Name>` voice tag, when the cue has one
     */
    speaker?: string | undefined;
};
