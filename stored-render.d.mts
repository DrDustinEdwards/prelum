/** The attribute on the wrapper of rendered writing that names the release that made it. */
export const RENDER_VERSION_ATTRIBUTE: "data-render-version";
/** HTML in its version wrapper (default this release's RENDER_VERSION); empty HTML stays empty. */
export function wrapRendered(html: string, version?: string): string;
/**
 * What a read shows for a stored row: the stored render at this release, else a render in memory, else (a body that no longer
 * renders) the stored HTML; wrapped in its version. `version` null shows the body as it is. `fresh` is false when the row
 * needs saving again.
 */
export function storedRender<M>(
  stored: { body: string; html: string | null; version: string | null; meta: M },
  options: {
    render: () => Promise<{ html: string; renderVersion: string; meta: M }>;
    current?: (html: string) => string | Promise<string>;
    onError?: (error: unknown) => void;
  },
): Promise<{ html: string; meta: M; version: string | null; fresh: boolean }>;
/** Render and save each row in turn; a row that fails goes to `onError` and is left as it is. */
export function rerenderEach<R, Out>(
  rows: Iterable<R>,
  options: {
    render: (row: R) => Promise<Out>;
    save: (row: R, rendered: Out) => Promise<unknown>;
    onError?: (row: R, error: unknown) => void;
  },
): Promise<{ done: number; failed: number }>;
