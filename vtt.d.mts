export type Cue = {
  /** seconds */
  start: number;
  /** seconds */
  end: number;
  /** the spoken text on one line, tags dropped and the format's character references decoded */
  text: string;
  /** the name in a `<v Name>` voice tag, when the cue has one */
  speaker?: string;
};
/**
 * The cues of a WebVTT file (https://www.w3.org/TR/webvtt1/), in order: identifiers, NOTE, STYLE and REGION blocks and cue
 * settings left out, markup dropped from the text, the voice's name kept as `speaker`. A cue with no text or an invalid
 * timing line is skipped.
 */
export function parseVtt(vtt: string | null | undefined): Cue[];
/** The cues' text as running text, one space between cues. */
export function transcriptText(cues: readonly Cue[]): string;
/** The time the last cue ends, in seconds; zero with no cues. */
export function transcriptDuration(cues: readonly Cue[]): number;
/** True for text that starts as WebVTT must: an optional byte order mark, then `WEBVTT` and a space, tab, line ending or the end. */
export function isVtt(text: string): boolean;
/**
 * Cues grouped into readable paragraphs, each cue keeping its timing: a paragraph ends at a sentence's end once it holds
 * `minWords` words (45), or at a silence longer than `gap` seconds (2.5).
 */
export function toParagraphs(
  cues: readonly Cue[],
  options?: { minWords?: number; gap?: number },
): Cue[][];
/** SubRip (SRT) as WebVTT: the header added, cue numbers dropped, timestamp commas made dots. */
export function srtToVtt(srt: string): string;
/** A cue's text split into a `Name: ` speaker, the spoken words, and whether it is non-verbal (`[MUSIC]`, `(laughs)`). */
export function parseCueText(raw: string | null | undefined): {
  speaker: string | null;
  text: string;
  nonVerbal: boolean;
};
