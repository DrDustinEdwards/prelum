/** Silent reading speed for non-fiction in English, from Brysbaert's 2019 meta-analysis of 190 studies (238 words a minute). */
export const WORDS_PER_MINUTE = 238;

const segmenter = new Intl.Segmenter("en", { granularity: "word" });

/**
 * Words as Unicode counts them (Intl.Segmenter), so "don't", "co-author" and a CJK sentence count the way a reader reads them, where a
 * whitespace split does not.
 *
 * @param {string} text
 * @returns {number}
 */
export function wordCount(text) {
  let words = 0;
  for (const segment of segmenter.segment(text)) if (segment.isWordLike) words += 1;
  return words;
}

/**
 * Minutes to read, never less than one: the words at WORDS_PER_MINUTE plus Medium's image time, 12 seconds for the first image and one
 * second less for each after it, down to 3.
 *
 * @param {number} words
 * @param {number} [images]
 * @returns {number}
 */
export function readingMinutes(words, images = 0) {
  let seconds = (words / WORDS_PER_MINUTE) * 60;
  for (let i = 0; i < images; i += 1) seconds += Math.max(12 - i, 3);
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Text cut to at most `max` characters at a word boundary, with an ellipsis when cut. Whitespace runs become one space.
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function excerpt(text, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}
