/**
 * Schemeless means relative and is allowed: footnotes and heading autolinks are fragments. The decoded form must pass too, so a
 * percent-encoded scheme cannot be smuggled past.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isAllowedUrl(value: string): boolean;
