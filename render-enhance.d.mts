/** Where `enhance` looks: CSS selectors for the rendered markup, the table of contents and the post body. */
export interface EnhanceOptions {
  /** The rendered markup the decorations apply inside (default ".prose"). */
  root?: string;
  /** The table of contents whose links track the current section (default ".post-toc"). */
  toc?: string;
  /** The post body the reading progress bar and the selection link measure (default ".post .prose"). */
  article?: string;
}
/** Decorates a rendered post in the browser: progress, scroll-spy, copy buttons, footnote previews, lightbox, selection links, embeds. A second call does nothing. */
export function enhance(options?: EnhanceOptions): void;
/** Click-to-play embeds alone: a click on `a.embed-link[data-embed-src]` inside `root` swaps in the player. `enhance` includes it. A second call does nothing. */
export function enhanceEmbeds(options?: { root?: string }): void;
