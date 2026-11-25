// What prelum-chart-audit does with one page: read it in each context and turn what the checks read into findings.

import {
  hasChart,
  openFolds,
  pinChart,
  quietShifts,
  readShifts,
  readStrays,
  scrollThrough,
  settle,
  stopPin,
  visitCharts,
} from "./chart-audit-page.mjs";
import { AXE_TAGS, D5_LIMIT, LIBRARIES, NARROW } from "./chart-audit-browser.mjs";
import { readCharts } from "./chart-audit-read.mjs";

/** @typedef {import("playwright-core").BrowserContext} BrowserContext */
/** @typedef {{ severity: "error" | "warning" | "unmeasured", item: string, url: string, detail: string }} Finding */

/**
 * @param {{
 *   origin: string,
 *   from: string | undefined,
 *   served: (url: string) => string,
 *   budget: number,
 *   budgetKb: string | undefined,
 *   frameSeverity: "error" | "warning",
 *   contexts: Record<"off" | "light" | "dark" | "narrow", BrowserContext>,
 *   scripts: Map<string, Promise<string>>,
 *   axeSource: string,
 *   enqueue: (url: string) => void,
 * }} env
 */
export function createAuditor(env) {
  const {
    origin,
    from,
    served,
    budget,
    budgetKb,
    frameSeverity,
    contexts,
    scripts,
    axeSource,
    enqueue,
  } = env;

  /**
   * One page: with scripts on in light first, and only when that finds a chart, a chart library or a drawn SVG, again with
   * scripts off and in dark.
   * @param {string} url
   * @returns {Promise<{ charts: number, findings: Finding[] }>}
   */
  async function auditPage(url) {
    const light = await visit(contexts.light, url, true);
    for (const frame of light.frames)
      enqueue(from && frame.startsWith(from) ? origin + frame.slice(from.length) : frame);
    const libraries = new Set([...light.libraries, ...(await scriptLibraries(light.scripts))]);
    if (light.units.length === 0 && light.drawn.length === 0 && libraries.size === 0)
      return { charts: 0, findings: [] };
    const off = await visit(contexts.off, url, false);
    const dark = await visit(contexts.dark, url, true);
    const narrow = await visit(contexts.narrow, url, true, true);
    /** @type {Finding[]} */
    const out = [];
    const add = (
      /** @type {"error" | "warning"} */ severity,
      /** @type {string} */ item,
      /** @type {string} */ detail,
    ) => out.push({ severity, item, url, detail });

    for (const unit of off.units) {
      const name = `${unit.label} (${unit.kind})`;
      if (unit.inline) {
        // An inline primitive carries its own words, or sits beside the words that carry its numbers.
        if (!unit.inline.ok)
          add(
            "error",
            "B18",
            `${name}: an inline primitive whose ${unit.inline.hidden ? "visible neighbor gives no numbers" : "name states no values or finding"}`,
          );
        for (const svg of unit.svgs)
          if (!svg.roleOk)
            add("error", "B28", `${name}: the SVG has role="${svg.role}", not role="img"`);
        continue;
      }
      if (!unit.drawing) add("error", "B2", `${name}: no SVG with scripts off`);
      if (!unit.title) add("error", "B18", `${name}: no visible title`);
      if (!unit.finding) add("error", "B18", `${name}: no finding sentence in the HTML`);
      else if (unit.findingHidden)
        add("warning", "B18", `${name}: the finding sentence is hidden from sight`);
      if (!unit.caption) add("error", "B18", `${name}: no caption`);
      if (!unit.table) add("error", "B30", `${name}: no data table`);
      else {
        if (unit.table.th === 0)
          add("error", "B28", `${name}: the data table has no th header cells`);
        if (unit.table.unscoped > 0)
          add("error", "B28", `${name}: ${unit.table.unscoped} th without scope`);
        if (!unit.table.caption) add("error", "B28", `${name}: the data table has no caption`);
      }
      for (const svg of unit.svgs) {
        if (!svg.roleOk)
          add(
            "error",
            "B28",
            `${name}: the SVG has role="${svg.role}", not role="img" (or role="group" with aria-roledescription="chart" when enhanced)`,
          );
        if (!svg.name) add("error", "B28", `${name}: the SVG has no accessible name`);
      }
      if (unit.bytes > budget)
        add(
          "error",
          "D6",
          `${name}: ${(unit.bytes / 1024).toFixed(1)} kB of inline SVG, over the ${budgetKb} kB budget`,
        );
      if (!unit.csv) add(frameSeverity, "C1", `${name}: no CSV link`);
      if (!unit.source) add(frameSeverity, "C2", `${name}: no source line`);
      if (!unit.frame)
        add(frameSeverity, "F", `${name}: not in Capsomer's chart frame (.cap-chart)`);
    }
    const offLabels = new Set(off.units.map((unit) => unit.label));
    for (const unit of light.units) {
      if (!offLabels.has(unit.label))
        add(
          "error",
          "B2",
          `${unit.label} (${unit.kind}): drawn only with scripts on, so there is no chart, text or table without them`,
        );
    }
    for (const [scheme, pass] of /** @type {const} */ ([
      ["light", light],
      ["dark", dark],
    ])) {
      for (const unit of pass.units) {
        const name = `${unit.label} (${unit.kind})`;
        const m = unit.measured;
        if (!m) continue;
        if (m.lowText)
          add(
            "error",
            "B1",
            `${name}, ${scheme}: ${m.lowText.count} text under 4.5:1, lowest "${m.lowText.sample}" ${m.lowText.fg} on ${m.lowText.bg} at ${m.lowText.ratio.toFixed(2)}:1`,
          );
        if (m.lowMark)
          add(
            "error",
            "B1",
            `${name}, ${scheme}: ${m.lowMark.count} marks under 3:1, lowest ${m.lowMark.sample} ${m.lowMark.fg} on ${m.lowMark.bg} at ${m.lowMark.ratio.toFixed(2)}:1`,
          );
        if (scheme === "light" && m.smallText)
          add(
            "error",
            "B3",
            `${name}: ${m.smallText.count} text under 12 px, smallest "${m.smallText.sample}" at ${m.smallText.px.toFixed(1)} px`,
          );
        for (const v of m.axe) add("error", "B27", `${name}, ${scheme}: axe ${v}`);
      }
    }
    for (const unit of narrow.units) {
      const name = `${unit.label} (${unit.kind}), ${NARROW} px`;
      // A table chart is a data table, which WCAG 1.4.10 lets scroll sideways in its frame (two-dimensional layout).
      if (unit.overflow && !/^table\b/.test(unit.kind))
        add(
          "error",
          "C12",
          `${name}: the drawing is ${unit.overflow.content} px wide in a ${unit.overflow.box} px frame, so it scrolls sideways`,
        );
      const small = unit.measured?.smallText;
      if (small)
        add(
          "error",
          "C12",
          `${name}: ${small.count} text under 12 px, smallest "${small.sample}" at ${small.px.toFixed(1)} px`,
        );
    }
    for (const [width, pass] of /** @type {const} */ ([
      [1280, light],
      [NARROW, narrow],
    ])) {
      const score = total(pass.shifts);
      if (score < D5_LIMIT) continue;
      const worst = [...pass.shifts].sort((a, b) => b.value - a.value)[0];
      add(
        "error",
        "D5",
        `at ${width} px, charts shift the page by ${score.toFixed(3)} (layout shift); largest ${worst.value.toFixed(3)}, ${worst.moved}`,
      );
    }
    for (const library of libraries)
      add("error", "F", `loads ${library}; every chart is drawn by Enarratio`);
    for (const library of light.libraryCharts)
      add(
        "error",
        "B2",
        `a ${library} chart is drawn in the browser, so with scripts off there is no chart, text or table`,
      );
    for (const svg of new Set([...off.drawn, ...light.drawn]))
      add("error", "F", `an SVG chart drawn outside Enarratio: ${svg}`);
    return {
      charts: Math.max(off.units.length, light.units.length) + light.libraryCharts.length,
      findings: out,
    };
  }

  /**
   * Opens a page in a context and reads its charts; `measured` also reads the painted colors, sizes and axe.
   * @param {BrowserContext} context
   * @param {string} url
   * @param {boolean} measured
   * @param {boolean} [narrow] the 320 px pass: overflow and text size, no axe
   */
  async function visit(context, url, measured, narrow = false) {
    // D5 is read at 1280 (the light pass) and at 320.
    const pinned = measured && (narrow || context === contexts.light);
    const page = await context.newPage();
    if (pinned) await page.addInitScript(pinChart, 0);
    /** @type {string[]} */
    const scriptUrls = [];
    page.on("response", (response) => {
      if (response.request().resourceType() === "script") scriptUrls.push(response.url());
    });
    try {
      let response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
      // A cache that now and then answers 200 with no body would read as a page with no chart. The
      // retry skips the browser's cache, which would otherwise revalidate and keep the empty body.
      for (
        let retry = 0;
        retry < 3 && response?.ok() && (await response.body()).length === 0;
        retry++
      ) {
        await (
          await context.newCDPSession(page)
        ).send("Network.setCacheDisabled", { cacheDisabled: true });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        response = await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
      }
      if (!response || response.status() >= 400)
        throw new Error(`answered ${response?.status() ?? "nothing"}`);
      if ((await response.body()).length === 0)
        throw new Error("answered 200 with an empty body four times in 12 seconds");
      // A page behind a sign-in wall (Cloudflare Access, a site's own login) shows the sign-in page in its place: no chart on it
      // was read, so it must not pass as a page with none.
      const signIn = await signInWall(page, served(url));
      if (signIn)
        throw new Error(`redirected to sign-in at ${signIn}, so its charts were never read`);
      if (measured)
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
      // A chart in a closed fold is read as the reader sees it once they open the fold: a frame redraws at its width only then.
      let foldsAt = -1;
      if (await page.evaluate(openFolds)) {
        foldsAt = await page.evaluate(() => performance.now() - 50);
        await page.waitForTimeout(500);
      }
      // D5: the first chart was held in view as the page loaded; from here the check scrolls the page itself.
      const loading = pinned ? await page.evaluate(stopPin) : null;
      if (measured) {
        // Scroll the page as a reader would, so a chart a site draws again (or swaps for its narrow drawing)
        // as it nears the viewport is measured as the reader sees it; at 1280 too, on a page with a chart, for D5.
        if (pinned && (narrow || (await page.evaluate(hasChart)))) {
          // Each chart is brought into view and given a moment first, as a reader reaching it: a shift only counts while the
          // moved element is on screen, so one a lazy chart makes after a fast scroll has passed it would go unseen (D5).
          await page.evaluate(visitCharts);
          await page.evaluate(scrollThrough);
        }
        await page.evaluate(settle);
        if (!narrow) await page.evaluate(axeSource);
      }
      const libraries = LIBRARIES.map(
        ([name, container, , global]) => /** @type {const} */ ([name, container, global]),
      );
      const units = await page.evaluate(readCharts, {
        measured,
        narrow,
        libraries,
        tags: AXE_TAGS,
      });
      const result = { units, ...(await page.evaluate(readStrays, libraries)) };
      /** @type {Array<{ t: number, value: number, moved: string }>} */
      let shifts = [];
      if (pinned && result.units.length > 0) {
        // A site may enhance its charts late (Foxhound's dashboard, about 5 s after load): the shifts are read once two seconds
        // pass with none.
        await page.evaluate(quietShifts, 0);
        shifts = await page.evaluate(readShifts, foldsAt);
        // A chart that changed its size out of sight as the page loaded moved nothing the Layout Instability API could count, so
        // the page is loaded again with that chart held in view, as a reader who scrolled to it would see it (at most 3 more loads).
        const opened = (/** @type {number} */ t) =>
          foldsAt >= 0 && t >= foldsAt && t < foldsAt + 1000;
        /** @type {Map<number, number>} */
        const unseen = new Map();
        for (const r of loading?.resized ?? [])
          if (r.index > 0 && !opened(r.t))
            unseen.set(r.index, Math.max(unseen.get(r.index) ?? 0, r.t));
        for (const [index, last] of [...unseen].slice(0, 3)) {
          if (total(shifts) >= D5_LIMIT) break;
          const again = await reloadPinned(context, url, index, last);
          if (total(again) > total(shifts)) shifts = again;
        }
      }
      for (const url of scriptUrls)
        if (!scripts.has(url))
          scripts.set(
            url,
            page.request
              .get(url)
              .then((r) => r.text())
              .catch(() => ""),
          );
      return { ...result, shifts, scripts: scriptUrls };
    } finally {
      await page.close();
    }
  }

  /**
   * Where a page sent the reader to sign in, or null when it did not: it landed on Cloudflare Access, was sent on to a sign-in or
   * log-in path, or was sent on to a page with a form that asks for a password. A password field on the page asked for is not a wall:
   * Capsomer's field demo (/components/field/states) shows one, and it answered 200 in place (2026-11-03).
   * @param {import("playwright-core").Page} page @param {string} asked
   */
  async function signInWall(page, asked) {
    const landed = new URL(page.url());
    const wall =
      /(?:^|\.)cloudflareaccess\.com$/i.test(landed.hostname) ||
      /\/cdn-cgi\/access\//i.test(landed.pathname) ||
      (landed.href !== asked &&
        (/\/(?:sign-?in|log-?in|auth)(?:\/|$)/i.test(landed.pathname) ||
          (await page.locator('input[type="password"]').count()) > 0));
    return wall ? landed.origin + landed.pathname : null;
  }

  /** The chart libraries whose code is in the scripts a page loaded. @param {string[]} urls */
  async function scriptLibraries(urls) {
    const names = new Set();
    for (const url of urls) {
      const code = (await scripts.get(url)) ?? "";
      for (const [name, , signature] of LIBRARIES) if (signature.test(code)) names.add(name);
    }
    return names;
  }

  /** The D5 score of a pass's chart shifts. @param {Array<{ value: number }>} shifts */
  function total(shifts) {
    return shifts.reduce((sum, s) => sum + s.value, 0);
  }

  /**
   * Loads a page again with its index-th chart held in view (D5), until a second past the time it last changed size in the first
   * load and then two quiet seconds; its chart shifts.
   * @param {BrowserContext} context @param {string} url @param {number} index @param {number} last
   */
  async function reloadPinned(context, url, index, last) {
    const page = await context.newPage();
    try {
      await page.addInitScript(pinChart, index);
      await page.goto(served(url), { waitUntil: "load", timeout: 30_000 });
      await page.evaluate(quietShifts, Math.min(last + 1000, 10_000));
      await page.evaluate(stopPin);
      return await page.evaluate(readShifts, -1);
    } catch {
      return [];
    } finally {
      await page.close();
    }
  }

  return auditPage;
}
