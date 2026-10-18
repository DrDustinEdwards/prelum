# Changelog

## 0.3.0 (2026-10-18)

### Changed

- `RENDER_VERSION` is "2". A task-list checkbox now sits in a `<label>` with its item's first line (the inline content after it, up
  to a nested list or the next block), so it has an accessible name; it had none, which axe reports as a critical failure. The name
  is the rendered text, read once. A site re-renders every page with a task list, and a site passing `assertSafe` its own allowlist
  adds `label`.

### Added

- `sitemapDocument` lists a page's images: an entry's `images` (absolute URLs) become Google image sitemap `<image:image>` elements,
  and the image namespace is declared only when some entry has one, so a sitemap without images is byte for byte unchanged.
- A code map: after each push to `main`, devkit's shared workflow publishes each module's functions, complexity and test
  coverage to the `code-map` branch for the Capsid system explorer (`.github/workflows/code-map.yml`).
- The specimen site (`specimen/`, https://prelum.dustinedwards.info) and its index, `elements.json`. Not part of the package:
  `files` ships the root modules only.

## 0.2.0 (2026-10-11)

### Added

- The markdown pipeline, moved from dustinedwards-info (`app/lib/content/pipeline.mjs`) as designed in carrel/design-markdown-pipeline.md.
  New imports: `render`, `render/packs`, `render/highlight`, `render/safe`, `render/conformance`, `render/math`, `render/url`.
  - `render({ file, body, resolveImage, options })` returns `{ html, toc, hasMath, mediaRefs, diagrams, blockedUrls, renderVersion }`.
  - The core holds the parser, math, the outline, the URL policy and the directives every site gets (`:::figure`, `:::details`). Media
    rules, code highlighting and extra directives are injected through `options` (`media`, `highlight`, `packs`), so nothing in the core
    imports site code and shiki is not bundled unless a site passes `highlight`.
  - `editorialPack` carries dustinedwards-info's own directives (`:::chart`, `:::diagram`, `:::sidenote`, `:pullquote`, `:swatch`) so
    another site opts into them rather than inheriting them.
  - `assertSafe` and `scanHtml` check rendered output with a parser against an allowlist derived from the benign corpus; `render` runs
    `assertSafe` when `options.assertSafe` is set (off by default).
    The corpus holds all four chart types (`test/fixtures/render/charts.md`): with only bar and line charts in it, `assertSafe`
    refused area and dot charts for their `fill-opacity`, `fill` and `stroke` attributes.
  - `HOSTILE_INPUTS` and `runConformance`: 44 hostile inputs for a site to run against its own configured renderer.
  - `maxBytes` (default 512 KB) and `maxDepth` (default 100) refuse a source before it can cost a Worker its time or its stack.
  - `RENDER_VERSION` is "1". A change to the output for any corpus input is a new version and a note here.
- The unified family, KaTeX and parse5 as optional peer dependencies (shiki and Enarratio for the two modules that use them).
- `skipLibCheck` in tsconfig, because Observable Plot's declarations import d3 types that are not installed.

### Changed from the code it was moved from

Three behaviours differ from dustinedwards-info's renderer, found in review, each with a test. None changes the output for content that
rendered correctly before; a site switching over should still compare its whole corpus.

- A `:pullquote` that cannot be raised (inside a list, quote or table) is refused with its line; it used to render a block `<div>` in
  the middle of a sentence.
- `:swatch{color=#fff}` with no label shows the hex as its label; it used to render an empty label.
- An image whose URL the policy blocks is no longer handed to `resolveImage`, and gets no wrapper link; it is shown as text. `scanHtml`
  also checks every URL in a `srcset`.

### Not changed

- Carrel and dustinedwards-info still render with their own copies. Switching them over is a separate step after a Prelum release.

## 0.1.0

- The XML escaping, RSS, Atom and JSON Feed, sitemap, llms.txt and FTS5 search helpers, each held byte for byte to the output of
  the site it came from.
