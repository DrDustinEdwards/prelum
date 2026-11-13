export interface Matter {
  /** The frontmatter's mapping; `{}` when the file has none or it holds only comments. */
  data: Record<string, unknown>;
  /** The file after the closing line and the one line break after it, or the whole file when it has no frontmatter. */
  content: string;
  /** The frontmatter's text between the fences, `""` when the file has none. */
  matter: string;
}

/**
 * The file's YAML frontmatter as data (YAML 1.2 core plus timestamps, so a bare date is a `Date`) and the rest of it. Throws on
 * a duplicate key, unreadable YAML, or a header that is not a mapping.
 */
export function matter(source: string): Matter;

/** A file from its content and data: the data as a `---` block, then the content. Empty data writes no block. */
export function stringifyMatter(content: string, data: Record<string, unknown>): string;
