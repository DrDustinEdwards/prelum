/**
 * Anchored on the attribute so prose or code blocks about KaTeX do not match.
 *
 * @param {string | null | undefined} html
 */
export function htmlHasMath(html: string | null | undefined): boolean;
export namespace KATEX_OPTIONS {
    let output: "htmlAndMathml";
    let strict: "error";
}
