// The directives dustinedwards-info writes with, registered as a pack so another site opts into them rather than inheriting them:
// :swatch, :pullquote, :::sidenote, :::chart and :::diagram. The core (render-nomath.mjs) knows nothing of these names. A site that needs a
// directive of its own writes a pack of the same shape: { name, directives, setup }.

import { visit } from "unist-util-visit";

import { buildChartModel, renderChartHast } from "./render-chart.mjs";
import { buildDiagramModel, renderDiagramHast } from "./render-diagram.mjs";
import {
  refuseHeading,
  rehypeModelMarker,
  remarkModelDirective,
} from "./render-directives.mjs";
import { ContentError } from "./render-error.mjs";

// Hex only: a named color, rgb() or color-mix() makes the render depend on the UA or the cascade.
// Anchored at both ends, or #6B4FBBZZ would pass on its prefix.
const SWATCH_HEX = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/**
 * Uppercased so two spellings of one color render the same bytes. The chip is aria-hidden because the
 * code-span label is the second channel. The inline --swatch style is already permitted by
 * style-src-attr 'unsafe-inline' in the site's CSP, which a site using this pack must allow.
 *
 * @param {string} file
 */
export function remarkSwatch(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" || node.name !== "swatch") return;

      const attrs = /** @type {Record<string, string>} */ (node.attributes ?? {});
      // Text children only: nested markup would put an element inside the <code> label.
      const label = (node.children ?? [])
        .map((child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();
      // A line of the BODY: the tree is parsed without frontmatter, and the editor preview has no file.
      const line = node.position?.start?.line;
      const where = `:swatch${line ? ` on line ${line} of the body` : ""}`;

      const raw = (attrs.color ?? label).trim();
      if (raw.length === 0) {
        throw new ContentError(
          file,
          `${where} carries no color. Write :swatch[#RRGGBB], or ` +
            `:swatch[a label]{color=#RRGGBB} when the label is not the hex.`,
        );
      }
      if (!SWATCH_HEX.test(raw)) {
        throw new ContentError(
          file,
          `${where} cannot use ${JSON.stringify(raw)} as a color. Only #RGB, ` +
            `#RRGGBB and #RRGGBBAA are accepted: a named color, rgb() or ` +
            `color-mix() would make the rendered page depend on something ` +
            `outside this file.`,
        );
      }

      const hex = raw.toUpperCase();
      // Only a hex label is uppercased; a prose label stays as written.
      const text = attrs.color && label ? label : hex;

      node.data = {
        ...node.data,
        hName: "span",
        hProperties: { className: ["swatch"] },
      };
      node.children = /** @type {any} */ ([
        {
          // emphasis is only an inline carrier: hName replaces the tag before serialization.
          type: "emphasis",
          data: {
            hName: "span",
            hProperties: {
              className: ["swatch-chip"],
              style: `--swatch:${hex}`,
              "aria-hidden": "true",
            },
          },
          children: [],
        },
        {
          type: "inlineCode",
          value: text,
          data: { hProperties: { className: ["swatch-label"] } },
        },
      ]);
    });
  };
}

const PULL_QUOTE_LIMIT = 2;

/**
 * Stays in the prose flow and the site's stylesheet floats it into the rail: that aligns it with its paragraph
 * without measuring, on a plane that does not hydrate.
 *
 * @param {string} file
 */
export function remarkSidenote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    let noteIndex = 0;
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "sidenote") return;

      const kind = (node.attributes ?? {}).kind;
      if (!kind) {
        throw new ContentError(
          file,
          ':::sidenote requires a kind attribute, for example :::sidenote{kind="Fallback"}. ' +
            "The label is the reader's only cue about what the note is before they read it.",
        );
      }

      refuseHeading(
        file,
        node,
        ". A heading is a section of the argument: it lands in the table of contents and is a " +
          "link target, and the rail is not where a section goes. Keep a note to prose.",
      );

      // Numbered in source order so #sn-1 stays the first note for anyone linking to it.
      noteIndex += 1;
      node.data = {
        ...node.data,
        hName: "aside",
        hProperties: { className: ["post-note"], id: `sn-${noteIndex}` },
      };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "b", hProperties: { className: ["post-note-kind"] } },
          children: [{ type: "text", value: String(kind) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

const PULL_QUOTE_MAX_CHARS = 160;

/**
 * Marks a sentence already in the prose instead of duplicating it, so the .md twin, which serves the
 * source verbatim, has it once. The raised copy is aria-hidden so a screen reader hears it once.
 *
 * @param {string} file
 */
export function remarkPullQuote(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    let raised = 0;
    visit(tree, (node, index, parent) => {
      if (node.type !== "paragraph" || parent?.type !== "root" || index === undefined) return;

      /** @type {any[]} */
      const marks = [];
      visit(node, "textDirective", (child) => {
        if (child.name === "pullquote") marks.push(child);
      });
      if (marks.length === 0) return;

      const line = marks[0].position?.start?.line;
      const where = `:pullquote${line ? ` on line ${line} of the body` : ""}`;

      if (marks.length > 1) {
        throw new ContentError(
          file,
          `${where}: one paragraph carries ${marks.length} pull quotes. A paragraph has one ` +
            "sentence worth raising, and two raised above the same paragraph read as a list.",
        );
      }

      const mark = marks[0];
      const text = (mark.children ?? [])
        .map((/** @type {any} */ child) => (child.type === "text" ? child.value : ""))
        .join("")
        .trim();

      if (text.length === 0) {
        throw new ContentError(
          file,
          `${where} is empty. Wrap the sentence it should raise: :pullquote[the sentence].`,
        );
      }
      if (text.length > PULL_QUOTE_MAX_CHARS) {
        throw new ContentError(
          file,
          `${where} is ${text.length} characters and the limit is ${PULL_QUOTE_MAX_CHARS}. ` +
            "A pull quote is read at a glance; mark the clause rather than the sentence.",
        );
      }

      const at = (node.children ?? []).indexOf(mark);
      if (at === -1) {
        throw new ContentError(
          file,
          `${where} is nested inside other markup. It must sit directly in the paragraph, so the ` +
            "sentence it raises is the sentence a reader reads.",
        );
      }

      raised += 1;
      if (raised > PULL_QUOTE_LIMIT) {
        throw new ContentError(
          file,
          `${where} is pull quote number ${raised} and the limit is ${PULL_QUOTE_LIMIT}. ` +
            "A third one is a page with no emphasis left to spend.",
        );
      }

      node.children.splice(at, 1, .../** @type {any[]} */ (mark.children ?? []));

      parent.children.splice(index, 0, {
        type: "paragraph",
        data: {
          hName: "p",
          hProperties: { className: ["pull-quote"], "aria-hidden": "true" },
        },
        children: [{ type: "text", value: text }],
      });

      // Skip the quote just inserted and the paragraph it came from.
      return index + 2;
    });

    // Every mark handled above was spliced out of its paragraph, so one still in the tree sits where the pull quote cannot be raised
    // (a list item, a quote, a table cell). Left alone it renders as a bare <div> in the middle of a sentence.
    visit(tree, "textDirective", (node) => {
      if (node.name !== "pullquote") return;
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `:pullquote${line ? ` on line ${line} of the body` : ""} is not in a top-level paragraph. A pull quote is raised above its ` +
          "paragraph, so it cannot sit inside a list, a quote or a table.",
      );
    });
  };
}

const remarkChart = remarkModelDirective({
  name: "chart",
  marker: "data-chart",
  className: "chart-figure",
  what: "data",
  build: buildChartModel,
});
const rehypeChart = rehypeModelMarker("data-chart", renderChartHast);

const remarkDiagram = remarkModelDirective({
  name: "diagram",
  marker: "data-diagram",
  className: "diagram-figure",
  what: "mermaid source",
  lang: "mermaid",
  build: buildDiagramModel,
});

/**
 * @typedef {object} RenderPack
 * @property {string} name
 * @property {readonly string[]} directives every directive name the pack handles, so the unknown-directive guard allows them
 * @property {(context: { file: string, body: string }) => {
 *   remark: Array<[unknown, ...unknown[]]>,
 *   rehype: Array<[unknown, ...unknown[]]>,
 *   result?: () => Record<string, unknown>,
 * }} setup called once per render; `result` is merged into what render returns
 */

/**
 * dustinedwards-info's directives, in the order its renderer ran them, so the output is the same bytes.
 *
 * @param {object} options
 * @param {string} options.assetPrefix the prefix of the site's diagram assets, for example "dustin-edwards-"
 * @returns {RenderPack}
 */
export function editorialPack({ assetPrefix }) {
  const rehypeDiagram = rehypeModelMarker("data-diagram", renderDiagramHast(assetPrefix));
  return {
    name: "editorial",
    directives: ["chart", "diagram", "pullquote", "sidenote", "swatch"],
    setup({ file }) {
      /** @type {any[]} */
      const charts = [];
      /** @type {any[]} */
      const diagrams = [];
      return {
        remark: [
          [remarkPullQuote, file],
          [remarkSidenote, file],
          [remarkSwatch, file],
          [remarkChart, file, charts],
          [remarkDiagram, file, diagrams],
        ],
        rehype: [
          [rehypeChart, charts],
          [rehypeDiagram, diagrams],
        ],
        result: () => ({
          diagrams: diagrams.map((/** @type {any} */ d) => ({ key: d.key, source: d.source })),
        }),
      };
    },
  };
}
