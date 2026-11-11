// WebVTT as the W3C defines it (https://www.w3.org/TR/webvtt1/): a `WEBVTT` header, then blocks separated by blank lines, each
// a cue (an optional identifier line, a timing line `hh:mm:ss.ttt --> hh:mm:ss.ttt` with optional settings, then the text) or a
// NOTE, STYLE or REGION block. The hours are optional, the milliseconds are three digits and the separator is a dot.

const TIME = String.raw`(?:(\d{2,}):)?([0-5]\d):([0-5]\d)\.(\d{3})`;
const TIMING = new RegExp(`^${TIME}[ \\t]+-->[ \\t]+${TIME}(?:[ \\t].*)?$`);
const SKIPPED_BLOCK = /^(?:NOTE|STYLE|REGION)(?:[ \t]|$)/;
const VOICE = /<v(?:\.[^\s>]+)*[ \t]+([^>]+)>/;

/**
 * @typedef {object} Cue
 * @property {number} start seconds
 * @property {number} end seconds
 * @property {string} text the spoken text on one line, tags dropped and the format's character references decoded
 * @property {string} [speaker] the name in a `<v Name>` voice tag, when the cue has one
 */

/** @param {string | undefined} h @param {string} m @param {string} s @param {string} ms */
const seconds = (h, m, s, ms) =>
  Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

/** The character references WebVTT allows in cue text (section 3.2.1). */
const REFERENCES = /&(amp|lt|gt|lrm|rlm|nbsp);/g;
/** @type {Record<string, string>} */
const DECODED = { amp: "&", lt: "<", gt: ">", lrm: "‎", rlm: "‏", nbsp: " " };

/**
 * The cues of a WebVTT file, in order, as a viewer reads them: the identifier, NOTE, STYLE and REGION blocks and the cue
 * settings left out, the markup (`<i>`, `<c.class>`, `<00:01.000>` timestamps) dropped from the text and the voice's name kept
 * as `speaker`. A cue with no text, or a timing line that is not valid WebVTT, is skipped. A byte order mark and any line
 * ending (CRLF, LF or CR) are accepted.
 *
 * @param {string | null | undefined} vtt
 * @returns {Cue[]}
 */
export function parseVtt(vtt) {
  const body = String(vtt ?? "")
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n");
  /** @type {Cue[]} */
  const cues = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n");
    if (SKIPPED_BLOCK.test(lines[0] ?? "") || /^WEBVTT(?:[ \t]|$)/.test(lines[0] ?? "")) continue;
    // The timing line is the first line, or the second when the first is an identifier.
    const at = TIMING.test(lines[0] ?? "") ? 0 : TIMING.test(lines[1] ?? "") ? 1 : -1;
    const m = at < 0 ? null : TIMING.exec(lines[at] ?? "");
    if (!m) continue;
    const raw = lines.slice(at + 1).join(" ");
    const speaker = VOICE.exec(raw)?.[1]?.trim();
    const text = raw
      .replace(/<[^>]*>/g, "")
      .replace(REFERENCES, (_, name) => DECODED[name] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    cues.push({
      start: seconds(m[1], m[2] ?? "0", m[3] ?? "0", m[4] ?? "0"),
      end: seconds(m[5], m[6] ?? "0", m[7] ?? "0", m[8] ?? "0"),
      text,
      ...(speaker ? { speaker } : {}),
    });
  }
  return cues;
}

/**
 * The cues' text as running text, one space between cues, for a model or a search that reads the words and not the timing.
 *
 * @param {readonly Cue[]} cues
 * @returns {string}
 */
export function transcriptText(cues) {
  return cues.map((cue) => cue.text).join(" ");
}

/**
 * The time the last cue ends, in seconds: the transcript's length as far as the cues say. Zero with no cues.
 *
 * @param {readonly Cue[]} cues
 * @returns {number}
 */
export function transcriptDuration(cues) {
  return cues.reduce((last, cue) => Math.max(last, cue.end), 0);
}

/**
 * True for text that starts as WebVTT must: an optional byte order mark, then `WEBVTT` followed by the end of the text, a
 * space, a tab or a line ending.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isVtt(text) {
  return /^﻿?WEBVTT(?:[ \t\r\n]|$)/.test(text);
}

/**
 * Caption-style cues grouped into readable paragraphs, each cue keeping its own timing. A paragraph ends at a sentence's end
 * once it holds `minWords` words, or at a silence longer than `gap` seconds.
 *
 * @param {readonly Cue[]} cues
 * @param {{ minWords?: number, gap?: number }} [options] 45 words and 2.5 seconds by default
 * @returns {Cue[][]}
 */
export function toParagraphs(cues, { minWords = 45, gap = 2.5 } = {}) {
  /** @type {Cue[][]} */
  const paragraphs = [];
  /** @type {Cue[]} */
  let current = [];
  let words = 0;
  cues.forEach((cue, i) => {
    current.push(cue);
    words += cue.text.split(/\s+/).length;
    const endsSentence = /[.!?]["'”’)\]]?$/.test(cue.text);
    const next = cues[i + 1];
    if ((endsSentence && words >= minWords) || (next && next.start - cue.end > gap)) {
      paragraphs.push(current);
      current = [];
      words = 0;
    }
  });
  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

/**
 * SubRip (SRT) as WebVTT: the header added, the cue numbers dropped and the comma in each timestamp made the dot WebVTT
 * requires.
 *
 * @param {string} srt
 * @returns {string}
 */
export function srtToVtt(srt) {
  const body = srt
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\d+[ \t]*$/gm, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body.trim()}\n`;
}

/**
 * A cue's text split into a speaker label, the spoken words, and whether it is a non-verbal cue such as `[MUSIC]` or
 * `(laughs)`. The speaker is a `Name: ` prefix, which some exporters leave where a `<v Name>` tag was; `parseVtt`'s own
 * `speaker` is the tag.
 *
 * @param {string | null | undefined} raw
 * @returns {{ speaker: string | null, text: string, nonVerbal: boolean }}
 */
export function parseCueText(raw) {
  const text = String(raw ?? "").trim();
  if (/^[[(][^\])]*[\])]$/.test(text)) return { speaker: null, text, nonVerbal: true };
  const m = /^([A-Z][A-Za-z0-9 .'-]{0,28}):\s+(.*)$/s.exec(text);
  if (m) return { speaker: (m[1] ?? "").trim(), text: (m[2] ?? "").trim(), nonVerbal: false };
  return { speaker: null, text, nonVerbal: false };
}
