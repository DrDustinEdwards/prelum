/**
 * Rendered HTML stored beside its Markdown, from germomics (app/lib/render.server.ts): a public read shows the stored render when
 * it is at this release's RENDER_VERSION, renders in memory when it is older (a cron stores it later), and keeps the last stored
 * HTML when the body no longer renders, so a page never fails on its own text. The HTML is wrapped in the version it was
 * rendered at (`data-render-version`), which render-audit's prelum-content check reads to see a page an upgrade left behind.
 */

import { RENDER_VERSION } from "./render-version.mjs";

/** The attribute on the wrapper of rendered writing that names the pipeline release that made it. */
export const RENDER_VERSION_ATTRIBUTE = "data-render-version";

/**
 * HTML in its version wrapper; empty HTML stays empty.
 *
 * @param {string} html
 * @param {string} [version] default this release's RENDER_VERSION
 * @returns {string}
 */
export function wrapRendered(html, version = RENDER_VERSION) {
  return (
    html &&
    `<div ${RENDER_VERSION_ATTRIBUTE}="${String(version).replace(/[^0-9A-Za-z.-]/g, "")}">${html}</div>`
  );
}

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
export async function storedRender(stored, { render, current, onError }) {
  if (stored.version === null)
    return { html: stored.body, meta: stored.meta, version: null, fresh: true };
  if (stored.version === RENDER_VERSION && stored.html !== null) {
    const html = current ? await current(stored.html) : stored.html;
    return {
      html: wrapRendered(html, RENDER_VERSION),
      meta: stored.meta,
      version: RENDER_VERSION,
      fresh: true,
    };
  }
  try {
    const r = await render();
    return {
      html: wrapRendered(r.html, r.renderVersion),
      meta: r.meta,
      version: r.renderVersion,
      fresh: false,
    };
  } catch (error) {
    onError?.(error);
    return {
      html: wrapRendered(stored.html ?? "", stored.version),
      meta: stored.meta,
      version: stored.version,
      fresh: false,
    };
  }
}

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
export async function rerenderEach(rows, { render, save, onError }) {
  let done = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await save(row, await render(row));
      done += 1;
    } catch (error) {
      failed += 1;
      onError?.(row, error);
    }
  }
  return { done, failed };
}
