/**
 * One slug rule for every site: accents folded to their base letter (café → cafe), every run of anything else that is
 * not a-z or 0-9 made one hyphen, no hyphen at either end, and at most `max` characters, cut back to a whole word when it
 * can be. The empty string when nothing is left, so a caller with a fallback writes `slugify(x) || "entry"`.
 *
 * @param {string} text
 * @param {{ max?: number }} [options]
 * @returns {string}
 */
export function slugify(text, { max = Infinity } = {}) {
  const slug = String(text)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length <= max ? slug : slug.slice(0, max).replace(/-+$/, "");
}
