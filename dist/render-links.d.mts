/**
 * `:lang[[Leer en español](https://es.example.com/)]{hreflang=es}` and `:xref[[Figure 2](#figure-2)]`: the directive syntax Prelum
 * already has (remark-directive's attributes, as `:abbr[]{title}` uses), wrapped round an ordinary link so the link stays a link in
 * the Markdown copy and on GitHub. Each holds exactly one link and becomes it; the tag is canonicalized (es-mx is es-MX), and one
 * Intl does not know is refused rather than written.
 *
 * @param {string} file
 */
export function remarkLinkDirectives(file: string): (/** @type {import("mdast").Root} */ tree: import("mdast").Root) => void;
/**
 * @typedef {object} LinkOptions
 * @property {string} [origin] The site's own origin. Without it no link is called away: a link to the site's own absolute URL would be.
 * @property {ReadonlyArray<{ id: string, href: string }>} [family] The family's sites: Capsomer's FAMILY_SITES, passed in by the site.
 * @property {(href: string) => Promise<number | null | undefined>} [fileSize] A file's size in bytes, or null when it is not known, in
 *   which case the meta names only the type.
 *
 * @typedef {import("./render-link-icons.mjs").LinkIconOptions} LinkIconOptions
 */
/**
 * Runs after the image links exist (so it can tell them from an author's link) and before the URL policy, which still sees every
 * href. Words are counted before it, so the hidden text and the meta are not in `words` or the excerpt.
 *
 * @param {LinkOptions} links
 * @param {LinkIconOptions | undefined} icons
 * @param {Array<Promise<void>>} pending
 */
export function rehypeLinks(links: LinkOptions, icons: LinkIconOptions | undefined, pending: Array<Promise<void>>): (/** @type {import("hast").Root} */ tree: import("hast").Root) => void;
/** The directives this module handles; CORE_DIRECTIVES lists them so the unknown-directive guard lets them through. */
export const LINK_DIRECTIVES: string[];
export type LinkOptions = {
    /**
     * The site's own origin. Without it no link is called away: a link to the site's own absolute URL would be.
     */
    origin?: string | undefined;
    /**
     * The family's sites: Capsomer's FAMILY_SITES, passed in by the site.
     */
    family?: readonly {
        id: string;
        href: string;
    }[] | undefined;
    /**
     * A file's size in bytes, or null when it is not known, in
     * which case the meta names only the type.
     */
    fileSize?: ((href: string) => Promise<number | null | undefined>) | undefined;
};
export type LinkIconOptions = import("./render-link-icons.mjs").LinkIconOptions;
