/** The directives this module handles; CORE_DIRECTIVES lists them so the unknown-directive guard lets them through. */
export const LINK_DIRECTIVES: string[];
/**
 * `:lang[[Leer en español](https://es.example.com/)]{hreflang=es}` and `:xref[[Figure 2](#figure-2)]`: each holds exactly one link
 * and becomes it, with the canonical hreflang or data-link="xref". A tag Intl does not know is refused.
 *
 * @param {string} file
 */
export function remarkLinkDirectives(file: string): (tree: import("mdast").Root) => void;
/**
 * Writes the link contract (data-link, data-site, rel="external", the hidden "(opens another site)", span.cap-link-meta and an away
 * link's icon) on every author link. The size and icon lookups are pushed onto `pending`, which render awaits before stringifying.
 *
 * @param {LinkOptions} links
 * @param {LinkIconOptions | undefined} icons
 * @param {Array<Promise<void>>} pending
 */
export function rehypeLinks(links: LinkOptions, icons: LinkIconOptions | undefined, pending: Array<Promise<void>>): (tree: import("hast").Root) => void;
export type LinkOptions = {
    /** The site's own origin. Without it no link is called away: a link to the site's own absolute URL would be. */
    origin?: string;
    /** The family's sites: Capsomer's FAMILY_SITES, passed in by the site. */
    family?: ReadonlyArray<{ id: string; href: string }>;
    /** A file's size in bytes, or null when it is not known, in which case the meta names only the type. */
    fileSize?: (href: string) => Promise<number | null | undefined>;
};
export type LinkIconOptions = import("./render-link-icons.mjs").LinkIconOptions;
