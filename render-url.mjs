// The URL allowlist lives at the render layer so one guard binds every writer: a site's build, its save path and Carrel's preview all
// call render. Pure predicates: rehypeUrlProtocols in render-nomath.mjs applies them to the rendered tree, and assertSafe applies them to the
// output.

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

/**
 * Browsers drop tab and newline anywhere in a URL, so java<TAB>script: is live. Every C0 control and DEL goes, stricter than the
 * spec, which can only block more: a NUL left in makes the scheme look relative.
 *
 * @param {string} raw
 * @returns {string}
 */
function normalizeForProtocolTest(raw) {
  let out = "";
  for (const character of raw) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) continue;
    // U+FFFD is what markdown makes of a NUL in a link destination; removing it exposes a hidden scheme.
    if (code === 0xfffd) continue;
    out += character;
  }
  return out.toLowerCase();
}

/**
 * @param {string} value
 * @returns {string | null}
 */
function protocolOf(value) {
  const match = /^([a-z][a-z0-9+.-]*):/.exec(normalizeForProtocolTest(value));
  return match ? `${match[1]}:` : null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function decodeOrSelf(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * A chart's "Download CSV" link (Enarratio, `a[download]`): a percent-encoded CSV, the one data: URL a page may carry. Only on a
 * link with `download`, which markdown cannot write, so an author's link never takes this path. Browsers refuse to navigate to a
 * data: URL, and CSV is not run, so the worst it can do is save a file.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isCsvDownload(value) {
  return /^data:text\/csv;charset=utf-8,[A-Za-z0-9%._~!*'()-]*$/.test(value);
}

/**
 * Schemeless means relative and is allowed: footnotes and heading autolinks are fragments. The decoded form must pass too, so a
 * percent-encoded scheme cannot be smuggled past.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedUrl(value) {
  for (const form of [value, decodeOrSelf(value)]) {
    const protocol = protocolOf(form);
    if (protocol !== null && !ALLOWED_PROTOCOLS.has(protocol)) return false;
  }
  return true;
}
