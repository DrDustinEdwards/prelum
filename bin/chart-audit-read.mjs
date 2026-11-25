// Runs inside each page to read its charts; Playwright serializes it, so it may use nothing outside its own body.

/**
 * In the page: every chart, what the checks read from it, and with `measured` its painted contrast, text sizes and axe violations.
 * @param {{ measured: boolean, narrow: boolean, libraries: Array<readonly [string, string | null, string | null]>, tags: string[] }} input
 */
export async function readCharts({ measured, narrow, libraries, tags }) {
  const text = (/** @type {Element | null | undefined} */ el) =>
    (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  const shown = (/** @type {Element} */ el) => {
    const box = el.getBoundingClientRect();
    return box.width * box.height > 2 && el.checkVisibility({ visibilityProperty: true });
  };
  const libraryContainers = libraries
    .map(([, container]) => container)
    .filter(Boolean)
    .join(", ");

  const roots = new Set();
  for (const el of Array.from(
    document.querySelectorAll(".enarratio[data-enarratio], .cap-chart"),
  )) {
    if (libraryContainers && el.closest(libraryContainers)) continue;
    roots.add(el.closest(".cap-chart") ?? el.closest("figure.enarratio") ?? el);
  }
  // A frame showing no data, or Capsomer's refusal in place of a chart, carries no figure to check.
  const units = [...roots].filter(
    (unit) => !["nodata", "refused"].includes(unit.getAttribute("data-state") ?? ""),
  );
  const PRIMITIVES = ["sparkline", "heat-strip", "progress-ring", "uptime-strip", "timeline"];
  // At the narrow width: a frame that scrolls (its content wider than its box), or a drawing wider than the chart around it.
  const overflowOf = (/** @type {Element} */ unit) => {
    for (const el of [
      unit,
      ...Array.from(
        unit.querySelectorAll(
          ".enarratio-frame, .cap-chart-figure, .cap-chart-body, figure.enarratio",
        ),
      ),
    ]) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0)
        return { content: el.scrollWidth, box: el.clientWidth };
    }
    const outer = (unit.matches("svg") ? unit.parentElement : unit)?.getBoundingClientRect();
    for (const svg of Array.from(unit.querySelectorAll("svg")).concat(
      unit.matches("svg") ? [/** @type {any} */ (unit)] : [],
    )) {
      const box = svg.getBoundingClientRect();
      if (outer && box.width > 0 && box.right > outer.right + 1)
        return { content: Math.round(box.width), box: Math.round(outer.width) };
    }
    return null;
  };

  // Paint on a one-pixel canvas, so any CSS color syntax and any alpha composite as the browser would.
  const ctx = /** @type {CanvasRenderingContext2D} */ (
    Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", {
      willReadFrequently: true,
    })
  );
  const dark =
    matchMedia("(prefers-color-scheme: dark)").matches &&
    /dark/.test(getComputedStyle(document.documentElement).colorScheme);
  const paint = (/** @type {Array<[string, number]>} */ layers) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = dark ? "#121212" : "#ffffff";
    ctx.fillRect(0, 0, 1, 1);
    for (const [color, alpha] of layers) {
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
    }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const behind = (/** @type {Element} */ el) => {
    /** @type {Array<[string, number]>} */
    const layers = [];
    for (let node = /** @type {Element | null} */ (el); node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") layers.unshift([bg, 1]);
    }
    return layers;
  };
  const luminance = (/** @type {number[]} */ rgb) => {
    const [r, g, b] = rgb
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const hex = (/** @type {number[]} */ rgb) =>
    `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  // Inside an SVG, what is behind a label is the page behind the SVG and then the last shape drawn before it that covers
  // its center (a label on a gene's box). A mark is read against the page, not against the marks it touches.
  /** @type {Map<Element, Array<{ el: Element, box: DOMRect, fill: string, alpha: number }>>} */
  const shapesOf = new Map();
  const under = (/** @type {Element} */ el) => {
    const svg = el instanceof SVGElement ? el.closest("svg") : null;
    if (!svg) return [];
    if (!shapesOf.has(svg)) {
      shapesOf.set(
        svg,
        Array.from(svg.querySelectorAll("rect, circle, ellipse, path, polygon")).flatMap(
          (shape) => {
            const style = getComputedStyle(shape);
            const alpha = Number(style.fillOpacity) * Number(style.opacity);
            const fill = solid(style.fill);
            return isColor(fill) && alpha > 0
              ? [{ el: shape, box: shape.getBoundingClientRect(), fill, alpha }]
              : [];
          },
        ),
      );
    }
    const box = el.getBoundingClientRect();
    const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
    /** @type {Array<[string, number]>} */
    let layer = [];
    for (const shape of /** @type {Array<{ el: Element, box: DOMRect, fill: string, alpha: number }>} */ (
      shapesOf.get(svg)
    )) {
      if (shape.el === el) break;
      if (
        shape.el.contains(el) ||
        x < shape.box.left ||
        x > shape.box.right ||
        y < shape.box.top ||
        y > shape.box.bottom
      )
        continue;
      // The box is only a first cut: an arc's box covers its hole, so the point must be in the painted shape itself.
      const toShape = shape.el instanceof SVGGeometryElement ? shape.el.getScreenCTM() : null;
      if (
        toShape &&
        !(
          /** @type {SVGGeometryElement} */ (shape.el).isPointInFill(
            new DOMPoint(x, y).matrixTransform(toShape.inverse()),
          )
        )
      )
        continue;
      layer = [[shape.fill, shape.alpha]];
    }
    return layer;
  };
  const contrast = (
    /** @type {Element} */ el,
    /** @type {string} */ color,
    /** @type {number} */ alpha,
    /** @type {Element} */ ground,
    label = false,
  ) => {
    const layers = [...behind(ground), ...(label ? under(el) : [])];
    const bg = paint(layers);
    const fg = paint([...layers, [color, alpha]]);
    const [a, b] = [luminance(fg), luminance(bg)];
    return {
      fg: hex(fg),
      bg: hex(bg),
      ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      el,
    };
  };
  const opacity = (/** @type {Element} */ el, /** @type {Element} */ stop) => {
    let value = 1;
    for (
      let node = /** @type {Element | null} */ (el);
      node && node !== stop.parentElement;
      node = node.parentElement
    )
      value *= Number(getComputedStyle(node).opacity);
    return value;
  };
  // The theme's grid color as painted where the chart is: the custom property's value, resolved by a probe element so
  // light-dark() and color functions resolve too.
  /** @type {Map<string, string>} */
  const grids = new Map();
  const gridOf = (/** @type {Element} */ el) => {
    const raw = getComputedStyle(el).getPropertyValue("--enarratio-grid").trim();
    if (!raw) return "";
    if (!grids.has(raw)) {
      const probe = document.createElement("span");
      probe.style.color = raw;
      (el.closest("svg")?.parentElement ?? document.body).append(probe);
      grids.set(raw, hex(paint([[getComputedStyle(probe).color, 1]])));
      probe.remove();
    }
    return grids.get(raw);
  };
  const isColor = (/** @type {string} */ paint) =>
    Boolean(paint) && !/^(none|transparent|url\()|^rgba\([^)]*,\s*0\)$/.test(paint);
  // A fill of url(#id) is painted by a pattern or a gradient: read it as the pattern's base <rect> (Enarratio's texture fills
  // draw the series color first, the texture over it) or the gradient's first stop, or it would read as nothing painted.
  /** @type {(paint: string, depth?: number) => string} */
  const solid = (paint, depth = 0) => {
    const ref = /^url\(\s*["']?#([^"')]+)["']?\s*\)/.exec(paint ?? "");
    if (!ref || depth > 3) return paint;
    const target = document.getElementById(ref[1]);
    if (!target) return paint;
    const tag = target.tagName.toLowerCase();
    if (tag === "pattern") {
      /** @type {Element | undefined} */
      const base = Array.from(target.querySelectorAll("rect")).find((rect) =>
        isColor(solid(getComputedStyle(rect).fill, depth + 1)),
      );
      return base ? solid(getComputedStyle(base).fill, depth + 1) : paint;
    }
    if (tag === "lineargradient" || tag === "radialgradient") {
      const stop = target.querySelector("stop");
      return stop ? getComputedStyle(stop).stopColor : paint;
    }
    return paint;
  };
  const describe = (/** @type {Element} */ el) => {
    const mark = el.closest("[data-enarratio-mark]")?.getAttribute("data-enarratio-mark");
    return `<${el.tagName.toLowerCase()}${mark ? ` in ${mark}` : ""}>`;
  };

  const out = units.map((unit, index) => {
    unit.setAttribute("data-chart-audit", String(index));
    const own = (/** @type {string} */ selector) =>
      unit.matches(selector) ? unit : unit.querySelector(selector);
    const svgs = [unit, ...Array.from(unit.querySelectorAll("svg"))].filter(
      (el) =>
        el.tagName.toLowerCase() === "svg" &&
        !el.parentElement?.closest("svg") &&
        el.getAttribute("aria-hidden") !== "true",
    );
    // Enarratio's `inline: true` primitive: the bare drawing, outside any figure or frame.
    // Enarratio's `inline: true` primitives: bare drawings, in no Enarratio figure, alone or in a frame that is not a chart's (a
    // Capsomer stat tile, a table cell). The unit is inline when every Enarratio drawing in it is one.
    const pieces = [unit, ...Array.from(unit.querySelectorAll("[data-enarratio]"))].filter((el) =>
      el.hasAttribute("data-enarratio"),
    );
    const bare =
      pieces.length > 0 &&
      !unit.matches("figure.enarratio") &&
      !unit.querySelector("figure.enarratio") &&
      pieces.every((el) => PRIMITIVES.includes(el.getAttribute("data-enarratio") ?? ""));
    /** @type {null | { hidden: boolean, ok: boolean }} */
    let inline = null;
    if (bare) {
      const verdicts = pieces.map((piece) => {
        if (piece.getAttribute("aria-hidden") === "true" || piece.closest("[aria-hidden='true']")) {
          // The words beside it: the nearest ancestor (a stat tile, a table row) with visible text of its own.
          let near = piece.parentElement;
          const said = (/** @type {Element} */ el) =>
            (/** @type {HTMLElement} */ (el).innerText ?? "").trim();
          while (near && near !== document.body && !said(near)) near = near.parentElement;
          return {
            hidden: true,
            ok: Boolean(near) && /\d/.test(said(/** @type {Element} */ (near))),
          };
        }
        const name =
          (piece.getAttribute("aria-label") ?? "").trim() ||
          (piece.getAttribute("aria-labelledby") ?? "")
            .split(/\s+/)
            .map((/** @type {string} */ id) => text(document.getElementById(id)))
            .join(" ")
            .trim();
        return {
          hidden: false,
          ok:
            piece.getAttribute("role") === "img" &&
            (/\d/.test(name) || name.split(/\s+/).length >= 4),
        };
      });
      inline = verdicts.find((v) => !v.ok) ?? { hidden: verdicts.every((v) => v.hidden), ok: true };
    }
    const drawing =
      own(".enarratio-frame svg, svg.enarratio, div.enarratio, .cap-chart-body svg") ??
      svgs[0] ??
      null;
    const title = text(own(".enarratio-title, .cap-chart-title"));
    const finding = own(".enarratio-finding, .enarratio-summary, .cap-chart-reason");
    const table = unit.querySelector("table");
    const names = svgs.map((svg) => {
      const labeledBy = (svg.getAttribute("aria-labelledby") ?? "")
        .split(/\s+/)
        .map((/** @type {string} */ id) => text(document.getElementById(id)))
        .join(" ")
        .trim();
      const role = svg.getAttribute("role") ?? "none";
      // WAI-ARIA APG: a static chart is an image; an enhanced one the reader can enter is a group described as a chart.
      const roleOk =
        role === "img" ||
        (role === "group" &&
          (svg.getAttribute("aria-roledescription") ?? "").trim().toLowerCase() === "chart");
      return {
        role,
        roleOk,
        name:
          (svg.getAttribute("aria-label") ?? "").trim() ||
          labeledBy ||
          text(svg.querySelector(":scope > title")),
      };
    });
    const kindFirst =
      [
        ...new Set(
          [unit, ...Array.from(unit.querySelectorAll("[data-enarratio]"))]
            .map((el) => el.getAttribute("data-enarratio"))
            .filter(Boolean),
        ),
      ].join("+") || "frame";
    const kind = bare ? `inline ${kindFirst}` : kindFirst;
    const label = unit.id ? `#${unit.id}` : `"${(title || names[0]?.name || kind).slice(0, 60)}"`;
    const sourceText = Array.from(unit.querySelectorAll("p, figcaption, small, footer")).some(
      (el) => /^(sources?|data)\s*:/i.test(text(el)),
    );
    return {
      label,
      kind,
      drawing: Boolean(drawing),
      title,
      finding: Boolean(text(finding)),
      findingHidden: Boolean(
        finding && (finding.closest("[data-summary='hidden']") || !shown(finding)),
      ),
      caption: Boolean(text(unit.querySelector("figcaption, .cap-chart-caption"))),
      table: table && {
        th: table.querySelectorAll("th").length,
        unscoped: Array.from(table.querySelectorAll("th")).filter((th) => !th.getAttribute("scope"))
          .length,
        caption: Boolean(text(table.querySelector("caption"))),
      },
      svgs: names,
      // D6 weighs the drawing a reader is shown (checklist D6: "inline SVG under a set size per chart"), not the data
      // table, which is the accessible equivalent, nor the narrow drawing the redraw spec holds for a phone.
      bytes:
        Array.from(unit.querySelectorAll(".enarratio-frame svg, svg[role='img']"))
          .filter((svg, _i, all) => !all.some((other) => other !== svg && other.contains(svg)))
          .reduce((sum, svg) => sum + new Blob([svg.outerHTML]).size, 0) ||
        new Blob([unit.outerHTML]).size,
      csv: Boolean(
        unit.querySelector(
          "a[href$='.csv' i], a[href*='.csv?' i], a[href^='data:text/csv' i], a[download][href*='csv' i], a.enarratio-csv, .enarratio-csv a",
        ),
      ),
      source:
        Boolean(unit.querySelector(".enarratio-source, .cap-chart-source, [data-chart-source]")) ||
        sourceText,
      frame: unit.matches(".cap-chart"),
      inline,
      overflow: narrow ? overflowOf(unit) : null,
      measured:
        /** @type {null | { lowText: any, lowMark: any, smallText: any, axe: string[] }} */ (null),
    };
  });

  if (measured) {
    for (const [index, unit] of units.entries()) {
      /** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */
      const lowText = [];
      /** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */
      const lowMark = [];
      /** @type {Array<{ px: number, el: Element }>} */
      const small = [];
      const texts = [
        ...(unit.matches("svg") ? [unit] : []),
        ...Array.from(unit.querySelectorAll("*")),
      ].filter(
        (el) =>
          el.tagName.toLowerCase() === "text" ||
          (!(el instanceof SVGElement) &&
            Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())),
      );
      for (const el of texts) {
        if (!shown(el)) continue;
        const style = getComputedStyle(el);
        const svg = el instanceof SVGGraphicsElement ? el : null;
        const ground = svg ? /** @type {Element} */ (svg.ownerSVGElement ?? svg) : el;
        const color = svg ? solid(style.fill) : style.color;
        if (isColor(color)) {
          const reading = contrast(
            el,
            color,
            opacity(el, unit) * (svg ? Number(style.fillOpacity) : 1),
            ground,
            true,
          );
          if (reading.ratio < 4.5) lowText.push(reading);
        }
        const matrix = svg?.getScreenCTM();
        const px =
          Number.parseFloat(style.fontSize) * (matrix ? Math.hypot(matrix.a, matrix.b) : 1);
        if (px < 11.95) small.push({ px, el });
      }
      for (const el of Array.from(
        unit.querySelectorAll(
          "rect, circle, ellipse, path, line, polyline, polygon, .enarratio-swatch",
        ),
      )) {
        if (
          el.closest(
            "defs, clipPath, mask, pattern, marker, [data-enarratio-mark*='grid'], [aria-hidden='true'] > title",
          ) ||
          !el.checkVisibility({ visibilityProperty: true })
        )
          continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        const style = getComputedStyle(el);
        const ground =
          el instanceof SVGGraphicsElement
            ? /** @type {Element} */ (el.ownerSVGElement ?? el)
            : /** @type {Element} */ (el.parentElement);
        const base = opacity(el, unit);
        // A mark is seen by its fill or its outline, whichever stands out more; a translucent fill (an area under its
        // line) and the grid color (gridlines, a ring's track) are context, not marks.
        const grid = gridOf(el);
        const paints =
          el instanceof SVGElement
            ? [
                ...(el.tagName.toLowerCase() !== "line"
                  ? [[solid(style.fill), base * Number(style.fillOpacity)]]
                  : []),
                ...(Number.parseFloat(style.strokeWidth) >= 0.5
                  ? [[solid(style.stroke), base * Number(style.strokeOpacity)]]
                  : []),
              ]
            : [
                [style.backgroundColor, base],
                // An HTML swatch's edge counts as its outline (Enarratio's 1px edge on a pale ramp step's legend swatch).
                ...(Number.parseFloat(style.borderTopWidth) >= 0.5
                  ? [[style.borderTopColor, base]]
                  : []),
              ];
        const readings = /** @type {Array<[string, number]>} */ (paints)
          .filter(
            ([color, alpha]) => isColor(color) && alpha >= 0.5 && hex(paint([[color, 1]])) !== grid,
          )
          .map(([color, alpha]) => contrast(el, color, alpha, ground));
        if (readings.length === 0) continue;
        const reading = readings.reduce((a, b) => (b.ratio > a.ratio ? b : a));
        // A shape hidden from assistive technology (itself or in a hidden group) and painted in the color behind it
        // draws nothing to see: a donut's hole, a halo under a label, or the gap a map draws between regions (B6
        // lets a separator be the ground). It is the ground, not a mark.
        if (el.closest("[aria-hidden='true']") && reading.ratio < 1.1) continue;
        if (reading.ratio < 3) lowMark.push(reading);
      }
      const lowest = (
        /** @type {Array<{ fg: string, bg: string, ratio: number, el: Element }>} */ list,
        /** @type {boolean} */ quote,
      ) => {
        if (list.length === 0) return null;
        const worst = list.reduce((a, b) => (b.ratio < a.ratio ? b : a));
        return {
          count: list.length,
          fg: worst.fg,
          bg: worst.bg,
          ratio: worst.ratio,
          sample: quote ? text(worst.el).slice(0, 40) : describe(worst.el),
        };
      };
      const smallest = small.length ? small.reduce((a, b) => (b.px < a.px ? b : a)) : null;
      out[index].measured = {
        lowText: lowest(lowText, true),
        lowMark: lowest(lowMark, false),
        smallText: smallest && {
          count: small.length,
          px: smallest.px,
          sample: text(smallest.el).slice(0, 40),
        },
        axe: [],
      };
    }
    // @ts-ignore axe is the axe-core source the audit evaluated in the page
    const axe = /** @type {any} */ (window).axe;
    if (units.length > 0 && axe) {
      const { violations } = narrow
        ? { violations: [] }
        : await axe.run(
            { include: [["[data-chart-audit]"]] },
            {
              runOnly: { type: "tag", values: tags },
              resultTypes: ["violations"],
              elementRef: true,
            },
          );
      for (const violation of violations) {
        /** @type {Map<number, number>} */
        const hits = new Map();
        for (const node of violation.nodes) {
          const index = Number(
            node.element?.closest("[data-chart-audit]")?.getAttribute("data-chart-audit"),
          );
          if (Number.isInteger(index)) hits.set(index, (hits.get(index) ?? 0) + 1);
        }
        for (const [index, count] of hits)
          out[index].measured?.axe.push(
            `${violation.id} (${violation.impact}): ${violation.help}, ${count} node${count === 1 ? "" : "s"}`,
          );
      }
    }
  }

  return out;
}
