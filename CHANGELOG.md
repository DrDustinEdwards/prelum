# Changelog

## Unreleased

## 0.6.0 (2026-10-24)

- `rssDocument` takes an optional `lastBuildDate` (any date `toDate` reads, written in RFC 822 after `<language>`) and an optional
  channel `image` (`url`, `title`, `link`, after the `atom:link`), and `rssItem` an optional `author` (RSS's
  `email (Name)` form, after `<pubDate>`): what foxhound's feed carries to match legacy Recova. Left out, the feed is unchanged.
- `llmsDocument` takes a prose section, `{ heading, body }`, beside the link-list form: the heading, a blank line, then the
  paragraphs as written, so a file that mixes prose with its lists (foxhound's llms.txt and llms-full.txt) is built from parts.
  A link-list section's output is unchanged.
- Specimen: site-runtime (a devDependency) is at v0.12.1. The published package is unchanged.
- Specimen: its policies and `Reporting-Endpoints` header come from site-runtime v0.12.0 (`specimen/headers.mjs`) instead of hand-written strings. The page policy is `buildContentSecurityPolicy` with `denyUnlisted` and `noForms`, the same directives as before except that the analytics beacon is allowed by its path rather than the whole host; the Worker's own 301 and 204 responses carry it too. `npm run specimen` writes both into `dist/_headers`, where `specimen/static/_headers` now holds placeholders. The `/diagrams/*` policy stays written in `_headers`: it allows no script, font or image source, which the builder cannot express.
- Specimen: Content-Security-Policy violation reports now have a sink. Both policies in `specimen/static/_headers` and the Worker's own add `report-uri /csp-report; report-to csp-endpoint` with a `Reporting-Endpoints` header, and `specimen/worker.mjs` answers `/csp-report` with site-runtime's `receiveCspReport`, rate-limited by a Workers rate-limit binding (60 a minute per address, as on the other sites) and logged to Workers Logs. `@dustinedwards/site-runtime` is a devDependency; the published package gains no dependency.
- The package no longer ships four stray declarations of test modules (`render-config.d.mts`, `render.test.d.mts`, `render-safe.test.d.mts`, `render-golden.test.d.mts`); `render-config.d.mts` named modules that do not exist. No public export changes.
- Internal helpers are no longer exported from their modules (`fnv1a32`, `normalizeDiagramSource`, `diagramKey`, `attributesOf`); none is on a package subpath. Rendered HTML is unchanged.
- Tests: the xml and itemPath tests in `prelum.test.mjs` that `xml.test.mjs` and `feeds.test.mjs` already make are gone, and so is the dated test baseline (`docs/research/`); the code-map workflow keeps the mutation results.
- README: the fixtures section no longer names dustinedwards-info's capture script, which that site deleted.
- Fixed: `createHighlight` passes shiki `tokenizeTimeLimit: 0`. Shiki's default stops tokenizing a line after 500 ms of wall-clock time and colours the rest of it as the last scope, so on a busy or cold machine (most often the first line, while Oniguruma compiles the grammar) a code block rendered to different bytes, and the golden test failed locally while CI passed. Now the output depends on the input alone. On a machine that never hit the limit nothing changes, so the golden hashes hold and `RENDER_VERSION` stays "3".

## 0.5.0 (2026-10-23)

### Added

- `render/nomath`: the same `render` with no math syntax. `$3,000 to $6,500` stays text instead of becoming an inline expression,
  `hasMath` is always false, and KaTeX, remark-math and rehype-katex are never imported, so a site with no math stops bundling them
  (about 560 KiB raw, 124 KiB gzip in txasm's Worker). The pipeline moved into `render-nomath.mjs`; `render` is that pipeline with KaTeX
  passed in, and its output is unchanged (`RENDER_VERSION` stays "3").

## 0.4.0 (2026-10-23)

### Changed

- The optional peer `enarratio` is `^0.3.1` (it was pinned to `0.1.0-alpha.8`, so a site on Enarratio 0.3 hit npm ERESOLVE). The
  charts come from `enarratio/plot`, which needs `@observablehq/plot` and `linkedom` installed beside it (Enarratio's own optional
  peers); a site that draws charts adds them.
- `RENDER_VERSION` is "3". Every chart's wide frame now carries `tabindex="0"`, `role="group"` and
  `aria-label="{title}, scrolls sideways"`, so a keyboard user can scroll it (Enarratio 0.3.0), and an area chart's bands are filled
  at 0.3 opacity with a 2px line along each top edge (Enarratio 0.3.1). A site re-renders every page with a chart, and a site passing
  `assertSafe` its own allowlist adds `div role` and `div aria-label`.

### Fixed

- `createHighlight` awaits the wasm loader before handing it to shiki. Shiki keeps its first wasm load for the isolate, a rejected
  one included, so one failed load failed every later render; now the next render loads it again.

## 0.3.1 (2026-10-23)

### Fixed

- RSS, Atom, JSON Feed and `datetime` sitemap dates read SQLite's `2026-06-21 09:30:00` as UTC, as `rfc822` and `isoDay` already
  did. A build on a machine outside UTC wrote them hours off. `toDate` is exported from `xml.mjs` for the same reading.
- `render` checks a site's `srcset` and image placeholder before writing them, since both land after the URL policy has run: a
  candidate URL outside the policy drops the srcset, and a placeholder that is not the base64 form drops the placeholder.
  `render/safe` exports `LQIP_STYLE` and `srcsetUrls`.
- `llmsLink` writes a `)` in a URL as `%29` and a line break in a title or description as a space, so a link stays one list item.
- The specimen's http-to-https redirect carries the same security headers as its pages.
- `.gitattributes` pins LF, so a Windows checkout passes the specimen and golden tests.

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
