/**
 * Reads the output the way a browser would and reports what it finds. The counts say how much was read, so zero violations cannot
 * mean zero read.
 *
 * @param {string} html
 * @param {Allowlist} [allowlist]
 * @returns {{ violations: Violation[], elements: number, attributes: number }}
 */
export function scanHtml(html: string, allowlist?: Allowlist): {
    violations: Violation[];
    elements: number;
    attributes: number;
};
/**
 * Fails closed: throws, so a save path refuses the write instead of storing HTML it could not vouch for.
 *
 * @param {string} html
 * @param {Allowlist} [allowlist]
 */
export function assertSafe(html: string, allowlist?: Allowlist): void;
/**
 * The tags and "tag attribute" pairs that appear in rendered output, for deriving the allowlist.
 *
 * @param {Iterable<string>} outputs rendered HTML fragments
 * @returns {{ tags: string[], attributes: string[] }} sorted
 */
export function inventory(outputs: Iterable<string>): {
    tags: string[];
    attributes: string[];
};
/**
 * `attributes` holds "tag attribute" pairs, one space between.
 */
export type Allowlist = {
    tags: ReadonlySet<string>;
    attributes: ReadonlySet<string>;
};
export type Violation = {
    kind: string;
    tag: string;
    attribute?: string;
    detail?: string;
};
