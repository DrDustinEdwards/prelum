/**
 * HTML in its version wrapper; empty HTML stays empty.
 *
 * @param {string} html
 * @param {string} [version] default this release's RENDER_VERSION
 * @returns {string}
 */
export function wrapRendered(html: string, version?: string): string;
/**
 * The HTML a read shows for a stored row, wrapped in its version. `stored.version` null means the row was never rendered
 * (its body is HTML already) and the body is shown as it is. `current` may adjust a current render before it is shown (a
 * figure the site now draws inline). `onError` hears about a body that no longer renders; the stored HTML is shown then.
 *
 * @template M
 * @param {{ body: string, html: string | null, version: string | null, meta: M }} stored
 * @param {{
 *   render: () => Promise<{ html: string, renderVersion: string, meta: M }>,
 *   current?: (html: string) => string | Promise<string>,
 *   onError?: (error: unknown) => void,
 * }} options
 * @returns {Promise<{ html: string, meta: M, version: string | null, fresh: boolean }>}
 */
export function storedRender<M>(stored: {
    body: string;
    html: string | null;
    version: string | null;
    meta: M;
}, { render, current, onError }: {
    render: () => Promise<{
        html: string;
        renderVersion: string;
        meta: M;
    }>;
    current?: (html: string) => string | Promise<string>;
    onError?: (error: unknown) => void;
}): Promise<{
    html: string;
    meta: M;
    version: string | null;
    fresh: boolean;
}>;
/**
 * Render each row again and save it, one at a time, so one row that no longer renders never stops the rest: a failure is
 * passed to `onError` and the row is left as it is. For a cron that moves stale renders to this release, or a media change
 * that moves the size URLs a body names.
 *
 * @template R, Out
 * @param {Iterable<R>} rows
 * @param {{
 *   render: (row: R) => Promise<Out>,
 *   save: (row: R, rendered: Out) => Promise<unknown>,
 *   onError?: (row: R, error: unknown) => void,
 * }} options
 * @returns {Promise<{ done: number, failed: number }>}
 */
export function rerenderEach<R, Out>(rows: Iterable<R>, { render, save, onError }: {
    render: (row: R) => Promise<Out>;
    save: (row: R, rendered: Out) => Promise<unknown>;
    onError?: (row: R, error: unknown) => void;
}): Promise<{
    done: number;
    failed: number;
}>;
