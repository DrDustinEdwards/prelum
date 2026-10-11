// The directives every site gets (:::figure, :::details), the guard that refuses an unknown one, and the two building blocks a site pack
// writes its own directives with. Nothing here imports site code; a site's extra directives are registered as a pack (render-packs.mjs).

import { visit } from "unist-util-visit";

import { ContentError, errorMessage } from "./render-error.mjs";

/**
 * Valueless attributes are dropped: they are indistinguishable from absent ones.
 *
 * @param {{ attributes?: Record<string, string | null | undefined> | null | undefined }} node
 * @returns {Record<string, string>}
 */
export function attributesOf(node) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(node.attributes ?? {})) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * @param {string} file
 */
export function remarkFigure(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "figure") return;

      const attrs = node.attributes ?? {};
      if (!attrs.src) {
        throw new ContentError(file, ":::figure requires a src attribute");
      }
      if (!attrs.alt) {
        // A figcaption is announced separately, so it is no substitute for alt.
        throw new ContentError(file, `:::figure ${attrs.src} requires an alt attribute`);
      }

      /** @type {any[]} */
      const captionChildren = [...(node.children ?? [])];

      /** @type {any[]} */
      const figureChildren = [
        {
          type: "paragraph",
          data: { hName: "img", hProperties: { src: attrs.src, alt: attrs.alt } },
          children: [],
        },
      ];

      if (captionChildren.length > 0 || attrs.credit) {
        /** @type {any[]} */
        const caption = [...captionChildren];
        if (attrs.credit) {
          caption.push({
            type: "paragraph",
            data: { hName: "span", hProperties: { className: ["figure-credit"] } },
            children: [{ type: "text", value: attrs.credit }],
          });
        }
        figureChildren.push({
          type: "paragraph",
          data: { hName: "figcaption" },
          children: caption,
        });
      }

      node.data = { ...node.data, hName: "figure" };
      node.children = figureChildren;
    });
  };
}

/**
 * remark-directive parses prose such as 4.5:1 and localhost:8080 as directives, and every real directive name is a word. Sliced from
 * the source so a label or attributes come back as written.
 *
 * @param {string} source the markdown these positions refer to
 */
export function remarkNumericTextDirectives(source) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, "textDirective", (node, index, parent) => {
      if (!parent || index === undefined || index === null) return;
      if (!/^\d/.test(node.name ?? "")) return;
      const { start, end } = node.position ?? {};
      if (start?.offset === undefined || end?.offset === undefined) return;
      parent.children[index] = {
        type: "text",
        value: source.slice(start.offset, end.offset),
        position: node.position,
      };
    });
  };
}

/**
 * Refuses a heading directly inside a container directive, naming the directive and the line.
 *
 * @param {string} file
 * @param {any} node the directive
 * @param {string} why completes the sentence that names the heading
 */
export function refuseHeading(file, node, why) {
  const heading = (node.children ?? []).find((/** @type {any} */ child) => child.type === "heading");
  if (!heading) return;
  const line = heading.position?.start?.line;
  throw new ContentError(file, `:::${node.name} holds a heading${line ? ` on line ${line}` : ""}${why}`);
}

/**
 * A heading inside is refused: it would put a hidden section in the table of contents. Native
 * <details>, so the text is in the HTML without script.
 *
 * @param {string} file
 */
export function remarkDetails(file) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "details") return;

      const summary = (node.attributes ?? {}).summary;
      if (!summary) {
        throw new ContentError(file, ":::details requires a summary attribute");
      }

      refuseHeading(
        file,
        node,
        ", which makes it a section of the argument rather than supplementary material. A " +
          "heading is in the table of contents and is a link target, so collapsing it hides a " +
          "section a reader was sent to. Use it for long methods, raw data or an appendix, and " +
          "leave the argument open.",
      );

      node.data = { ...node.data, hName: "details", hProperties: { className: ["post-details"] } };
      node.children = [
        {
          type: "paragraph",
          data: { hName: "summary" },
          children: [{ type: "text", value: String(summary) }],
        },
        .../** @type {any[]} */ (node.children ?? []),
      ];
    });
  };
}

/** The directives the core handles itself. A pack adds its own names to the list the guard checks. */
export const CORE_DIRECTIVES = ["details", "figure"];

/**
 * An unhandled directive becomes a silent empty <div>, so a typo such as :::figrue loses the figure. Runs after
 * remarkNumericTextDirectives, so prose like 12:30 is already text.
 *
 * @param {string} file
 * @param {readonly string[]} known every directive name the renderer and its packs handle
 */
export function remarkUnknownDirectives(file, known) {
  return (/** @type {import("mdast").Root} */ tree) => {
    visit(tree, (node) => {
      // Named rather than matched on a suffix, so TypeScript narrows the union.
      if (
        node.type !== "containerDirective" &&
        node.type !== "leafDirective" &&
        node.type !== "textDirective"
      ) {
        return;
      }
      const type = node.type;
      const name = node.name ?? "";
      if (known.includes(name)) return;

      const marker =
        type === "containerDirective" ? ":::" : type === "leafDirective" ? "::" : ":";
      const line = node.position?.start?.line;
      throw new ContentError(
        file,
        `unknown directive "${marker}${name}"${line ? ` on line ${line}` : ""}. ` +
          `Known directives: ${known.join(", ")}. ` +
          "If this is ordinary prose, escape the colon as \\: or wrap it in a code span.",
      );
    });
  };
}

/**
 * Split across remark and rehype: validation must fail the build in remark, but the caption only
 * becomes hast after remark-rehype. The remark half of a model directive: a container holding
 * exactly one fenced block, built into a model and marked with the model's index for the rehype half.
 *
 * @param {{
 *   name: string,
 *   marker: string,
 *   className: string,
 *   what: string,
 *   lang?: string,
 *   build: (attributes: any, source: string) => any,
 * }} kind `what` names the fence's content in the refusal; `lang` is the fence language required, if any
 */
export function remarkModelDirective(kind) {
  /**
   * @param {string} file
   * @param {any[]} sink models, indexed by the marker written onto the node
   */
  return (file, sink) =>
    (/** @type {import("mdast").Root} */ tree) => {
      visit(tree, (node) => {
        if (node.type !== "containerDirective" || node.name !== kind.name) return;

        const children = node.children ?? [];
        const fences = children.filter((c) => c.type === "code");
        const fence = fences[0];
        if (fences.length !== 1 || !fence) {
          throw new ContentError(
            file,
            `:::${kind.name} requires exactly one fenced code block of ${kind.what}, found ${fences.length}`,
          );
        }
        // The mermaid fence is also what renders the source as a diagram in the .md twin and on GitHub.
        const lang = fence.lang ?? "";
        if (kind.lang !== undefined && lang !== kind.lang) {
          throw new ContentError(
            file,
            `:::${kind.name} source must be a \`\`\`${kind.lang} fenced block, found \`\`\`${lang || "(none)"}`,
          );
        }

        /** @type {any} */
        let model;
        try {
          model = kind.build(attributesOf(node), fence.value);
        } catch (error) {
          throw new ContentError(file, errorMessage(error));
        }

        const index = sink.push(model) - 1;
        node.data = {
          ...node.data,
          hName: "figure",
          hProperties: { className: [kind.className], [kind.marker]: String(index) },
        };
        node.children = children.filter((/** @type {any} */ c) => c.type !== "code");
      });
    };
}

/**
 * The rehype half: renders each marked figure from its model and drops the marker.
 *
 * @param {string} marker
 * @param {(model: any, caption: any[], node: any) => any[]} render
 */
export function rehypeModelMarker(marker, render) {
  /** @param {any[]} models */
  return (models) =>
    (/** @type {import("hast").Root} */ tree) => {
      visit(tree, "element", (node) => {
        const at = node.properties?.[marker];
        if (at === undefined) return;
        const model = models[Number(at)];
        delete node.properties[marker];
        node.children = render(model, node.children ?? [], node);
      });
    };
}
