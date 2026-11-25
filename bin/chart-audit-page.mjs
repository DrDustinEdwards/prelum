// The functions prelum-chart-audit runs inside the page it audits. Playwright serializes each one, so none may use anything
// outside its own body.

/** In the page: scroll to the end a screen at a time, then back to the top. */
export async function scrollThrough() {
  for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
    scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  scrollTo(0, 0);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

/**
 * In the page: open each closed fold (a details element) that holds a chart, leaving Enarratio's own "Show data" folds as they
 * are; how many it opened. Capsid's Portal keeps its overview's trends folded (2026-11-03).
 */
export function openFolds() {
  let opened = 0;
  for (const fold of Array.from(
    document.querySelectorAll("details:not([open]):not(.enarratio-data)"),
  )) {
    if (!fold.querySelector(".enarratio[data-enarratio], .cap-chart")) continue;
    /** @type {HTMLDetailsElement} */ (fold).open = true;
    opened++;
  }
  return opened;
}

/** In the page: fonts loaded and every finite animation finished, so colors are read as they rest. */
export function settle() {
  const animations = document
    .getAnimations()
    .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
  const done = Promise.all([
    document.fonts.ready,
    ...animations.map((a) => a.finished.catch(() => undefined)),
  ]);
  return Promise.race([done, new Promise((resolve) => setTimeout(resolve, 3000))]).then(
    () => undefined,
  );
}

/**
 * In the page, before its scripts: keeps each layout shift with no recent input (the Layout Instability API, which CLS sums)
 * that moved an element inside a chart, for D5.
 */
export function watchShifts() {
  /** @type {Array<{ t: number, value: number, moved: string }>} */
  const shifts = [];
  Object.defineProperty(window, "__chartAuditShifts", { value: shifts });
  try {
    new PerformanceObserver((list) => {
      for (const entry of /** @type {any[]} */ (list.getEntries())) {
        if (entry.hadRecentInput) continue;
        for (const source of entry.sources ?? []) {
          const el = source.node?.nodeType === 1 ? source.node : source.node?.parentElement;
          const chart = el?.closest?.(".cap-chart, figure.enarratio, .enarratio[data-enarratio]");
          if (!chart) continue;
          const tag = `${el.localName}${el.classList.length ? `.${[...el.classList].join(".")}` : ""}`;
          const dy = Math.round(source.currentRect.y - source.previousRect.y);
          const dh = Math.round(source.currentRect.height - source.previousRect.height);
          // Which chart and when, so a shift that comes and goes between runs can be traced to its chart and its moment.
          const title = (
            chart.querySelector(".enarratio-title, .cap-chart-title")?.textContent ?? ""
          )
            .trim()
            .slice(0, 40);
          shifts.push({
            t: entry.startTime,
            value: entry.value,
            moved: `${tag} ${dy >= 0 ? "+" : ""}${dy} px${dh ? `, height ${dh >= 0 ? "+" : ""}${dh}` : ""}${title ? ` in "${title}"` : ""} at ${Math.round(entry.startTime)} ms`,
          });
          break;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    // A browser without the API reports nothing.
  }
}

/** In the page: whether it holds a chart, so a page with none is not scrolled at 1280. */
export function hasChart() {
  return document.querySelector(".cap-chart, .enarratio[data-enarratio]") !== null;
}

/** In the page: scroll each chart to the middle of the screen in turn and wait 400 ms there. */
export async function visitCharts() {
  for (const chart of Array.from(document.querySelectorAll(".cap-chart, figure.enarratio"))) {
    if (chart.parentElement?.closest(".cap-chart, figure.enarratio")) continue;
    chart.scrollIntoView({ block: "center" });
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

/**
 * In the page, before its scripts (D5): from the first frame, keep the index-th chart's top at the top of the screen, as a
 * reader who scrolled to it sees it while it is enhanced, and note each chart whose height changed while it was out of sight,
 * since its shift moved nothing on screen and so went uncounted. Runs until stopPin. @param {number} index
 */
export function pinChart(index) {
  const ROOT = ".cap-chart, figure.enarratio";
  /** @type {Array<{ index: number, t: number }>} */
  const resized = [];
  /** @type {number[]} */
  const heights = [];
  const state = { stop: false, resized };
  Object.defineProperty(window, "__chartAuditPin", { value: state });
  const frame = () => {
    if (state.stop) return;
    const charts = Array.from(document.querySelectorAll(ROOT)).filter(
      (chart) => !chart.parentElement?.closest(ROOT),
    );
    charts.forEach((chart, i) => {
      const box = chart.getBoundingClientRect();
      if (box.width === 0) return;
      const inSight =
        box.height <= innerHeight
          ? box.top >= 0 && box.bottom <= innerHeight
          : box.top < innerHeight && box.bottom > 0;
      if (heights[i] !== undefined && Math.abs(box.height - heights[i]) >= 1 && !inSight)
        resized.push({ index: i, t: performance.now() });
      heights[i] = box.height;
    });
    const top = charts[index]?.getBoundingClientRect().top;
    if (top !== undefined && Math.abs(top) >= 1) scrollBy(0, top);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** In the page: stop pinChart; the charts that changed size out of sight. */
export function stopPin() {
  const state =
    /** @type {{ stop: boolean, resized: Array<{ index: number, t: number }> } | undefined} */ (
      /** @type {any} */ (window).__chartAuditPin
    );
  if (!state) return { resized: [] };
  state.stop = true;
  return { resized: state.resized };
}

/** In the page: wait until it is `until` ms since navigation and then two seconds pass with no layout shift, or ten in all. @param {number} until */
export function quietShifts(until) {
  return new Promise((resolve) => {
    let timer = setTimeout(done, Math.max(0, until - performance.now()) + 2000);
    const stop = setTimeout(done, 10_000);
    const observer = new PerformanceObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(done, Math.max(0, until - performance.now()) + 2000);
    });
    function done() {
      clearTimeout(timer);
      clearTimeout(stop);
      observer.disconnect();
      resolve(undefined);
    }
    try {
      observer.observe({ type: "layout-shift" });
    } catch {
      done();
    }
  });
}

/** In the page: the chart shifts watchShifts kept, less those in the second after a fold the check opened. @param {number} opened */
export function readShifts(opened) {
  const shifts = /** @type {Array<{ t: number, value: number, moved: string }>} */ (
    /** @type {any} */ (window).__chartAuditShifts ?? []
  );
  return shifts.filter((s) => !(opened >= 0 && s.t >= opened && s.t < opened + 1000));
}

/**
 * In the page: the chart libraries it carries, the SVG charts it draws outside Enarratio, and its iframes.
 * @param {Array<readonly [string, string | null, string | null]>} libraries
 */
export function readStrays(libraries) {
  const text = (/** @type {Element | null | undefined} */ el) =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const libraryContainers = libraries
    .map(([, container]) => container)
    .filter(Boolean)
    .join(", ");
  /** @type {string[]} */
  const found = [];
  /** @type {string[]} */
  const libraryCharts = [];
  for (const [name, container, global] of libraries) {
    const count = container ? document.querySelectorAll(container).length : 0;
    if (count > 0) libraryCharts.push(name);
    // @ts-ignore a library's page global
    if (count > 0 || (global && window[global])) found.push(name);
  }
  // An SVG drawn from data outside Enarratio: a polyline, or five or more marks of one kind that vary as data does (bars
  // of different lengths, a strip of slots, five dots of one size at different places, five lines of different lengths on
  // one baseline). An illustration's circles of every size and its leader lines (a plate of plaques), a diagram's boxes
  // that hold their labels and its polygon nodes, a Prelum diagram (figure.blog-diagram), a diagram's ports (a dot on the end of one of its wires), and
  // a decorative drawing hidden from assistive technology (a badge, an audio waveform) do not count.
  /** @type {string[]} */
  const drawn = [];
  const distinct = (/** @type {number[]} */ list) =>
    new Set(list.map((n) => Math.round(n * 2))).size;
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    if (
      svg.parentElement?.closest("svg") ||
      svg.closest(".enarratio, [data-enarratio], .blog-diagram") ||
      (libraryContainers && svg.closest(libraryContainers))
    )
      continue;
    const box = svg.getBoundingClientRect();
    if (box.width < 60 || box.height < 16) continue;
    if (svg.getAttribute("aria-hidden") === "true" && svg.querySelector("text")) continue;
    // A drawing hidden from assistive technology beside the control that states its value (an audio player's waveform) is
    // decoration: a chart is one a reader can perceive, with its table.
    if (svg.closest("[aria-hidden='true']")) continue;
    const boxes = (/** @type {string} */ tag) =>
      Array.from(svg.querySelectorAll(tag)).map((el) => el.getBoundingClientRect());
    const labels = boxes("text").map((t) => [t.x + t.width / 2, t.y + t.height / 2]);
    const rects = boxes("rect").filter(
      (r) => !labels.some(([x, y]) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom),
    );
    const ends = Array.from(svg.querySelectorAll("path")).flatMap((path) => {
      const matrix = path.getScreenCTM();
      const length = path.getTotalLength();
      if (!matrix || !(length > 0)) return [];
      return [0, length].map((at) => path.getPointAtLength(at).matrixTransform(matrix));
    });
    const port = (/** @type {DOMRect} */ d) =>
      ends.some((end) => Math.hypot(end.x - (d.x + d.width / 2), end.y - (d.y + d.height / 2)) < 1);
    const dots = boxes("circle, ellipse").filter((d) => !port(d));
    const lines = boxes("line");
    const polyline = Array.from(svg.querySelectorAll("polyline")).some(
      (el) => /** @type {SVGPolylineElement} */ (el).points.length >= 4,
    );
    // Bars stand on one baseline (or against one axis): five rects share a bottom, top, left or right edge. A wireframe's
    // panels and a waveform's centered bars do not.
    const aligned = [
      (/** @type {DOMRect} */ r) => r.bottom,
      (/** @type {DOMRect} */ r) => r.top,
      (/** @type {DOMRect} */ r) => r.left,
      (/** @type {DOMRect} */ r) => r.right,
    ].some((edge) =>
      rects.some((r) => rects.filter((q) => Math.abs(edge(q) - edge(r)) < 0.5).length >= 5),
    );
    const why = polyline
      ? "a polyline"
      : rects.length >= 5 &&
          aligned &&
          (distinct(rects.map((r) => r.height)) >= 3 ||
            distinct(rects.map((r) => r.width)) >= 3 ||
            (rects.length >= 8 && distinct(rects.map((r) => r.x)) >= 8))
        ? `${rects.length} rects`
        : dots.length >= 5 &&
            distinct(dots.map((d) => d.x * 10_000 + d.y)) >= 5 &&
            dots.some((d) => dots.filter((e) => Math.abs(e.width - d.width) < 0.5).length >= 5)
          ? `${dots.length} dots`
          : lines.length >= 5 &&
              distinct(lines.map((l) => Math.hypot(l.width, l.height))) >= 3 &&
              [(/** @type {DOMRect} */ l) => l.bottom, (/** @type {DOMRect} */ l) => l.left].some(
                (edge) =>
                  lines.some(
                    (l) => lines.filter((m) => Math.abs(edge(m) - edge(l)) < 0.5).length >= 5,
                  ),
              )
            ? `${lines.length} lines`
            : null;
    if (!why) continue;
    const heading = svg
      .closest("section, figure, article")
      ?.querySelector("h1, h2, h3, h4, figcaption");
    const name =
      (svg.getAttribute("aria-label") ?? "").trim() ||
      text(heading) ||
      svg.getAttribute("class") ||
      "an svg";
    drawn.push(`"${name.slice(0, 60)}" (${why})`);
  }
  const frames = Array.from(document.querySelectorAll("iframe[src]")).map(
    (frame) => /** @type {HTMLIFrameElement} */ (frame).src,
  );
  return { libraries: found, libraryCharts, drawn, frames };
}
