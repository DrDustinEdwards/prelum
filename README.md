# Prelum

The shared publishing code for the Dustin Edwards sites (ruling capsid/rulings/shared-homes-2026-10-06.md): the code that turns a site's
content into the documents it publishes. This repository was `DrDustinEdwards/site-helpers` and was renamed, keeping its history and
tags. The package is still named `@drdustinedwards/site-helpers` and is installed by tag:
`"@drdustinedwards/site-helpers": "github:DrDustinEdwards/prelum#v0.3.0"`.

Pure ES modules, Web-standard only, so the same file runs in a Worker and in Node. The helpers have no dependencies; the markdown pipeline
needs the unified family, KaTeX and parse5, which are optional peers: a site that only builds feeds installs none of them.

## What it holds

The helpers every site wrote for itself, written once here in the form of the best of them:

| Module | Exports |
| --- | --- |
| `xml` | `escapeXml`, `escapeXmlText`, `cdata`, `rfc822`, `isoDay`, `absolutiseUrls`, `mathToTex` |
| `feeds` | `rssDocument`, `rssItem`, `atomDocument`, `atomEntry`, `jsonFeedDocument`, `feedItem` (`itemPath` moves where a post lives) |
| `sitemap` | `sitemapDocument(entries, { layout, lastmodFormat, trailingNewline })`; an entry's `images` list it in the image sitemap |
| `llms` | `llmsDocument`, `llmsLink` |
| `search` | `ftsLiteral`, `toMatchExpression`, `fuse`, `RRF_K` |
| `render` | `render`, `RENDER_VERSION`, `ContentError`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_DEPTH`, `isAllowedUrl` |
| `render/packs` | `editorialPack`, the `RenderPack` shape a site's own directives take |
| `render/highlight` | `createHighlight`, `LANGUAGES`, `SHIKI_THEMES` |
| `render/safe` | `assertSafe`, `scanHtml`, `inventory` |
| `render/conformance` | `HOSTILE_INPUTS`, `runConformance` |
| `render/math`, `render/url` | `htmlHasMath`, `KATEX_OPTIONS`; `isAllowedUrl` |

## The markdown pipeline

Markdown in, a safe HTML fragment out (carrel/design-markdown-pipeline.md). It is dustinedwards-info's renderer, moved here so every
site that publishes Carrel's writing renders it the same way. The `render` import is deliberately light: it holds the parser, the
directives every site gets (`:::figure`, `:::details`), math, the table of contents and the URL policy. What a site decides it injects:

```js
import { render } from "@drdustinedwards/site-helpers/render";
import { editorialPack } from "@drdustinedwards/site-helpers/render/packs";
import { createHighlight } from "@drdustinedwards/site-helpers/render/highlight";

const { html, toc, hasMath, mediaRefs, diagrams, blockedUrls, renderVersion } = await render({
  file: "content/posts/example.md", // for error messages
  body, // markdown with any frontmatter already stripped
  resolveImage, // async (src) => ({ width, height, placeholder? })
  options: {
    media: { keyOf, imageProps }, // the site's image rules; without them images are left as written
    packs: [editorialPack({ assetPrefix: "dustin-edwards-" })], // chart, diagram, sidenote, pullquote, swatch
    highlight: createHighlight({ wasm }), // without it a code block is plain <pre><code>
    maxBytes: 512 * 1024, // refused before parsing
    maxDepth: 100, // refused after parsing
    assertSafe: true, // scan the output and throw on anything outside the allowlist; off by default
  },
});
```

The output is a fragment: no `<html>`, no layout. A site gives it its own layout and its own CSS for the classes the pipeline emits
(`heading-anchor`, `table-scroll`, `image-link`, `post-details`, `figure-credit`, and a pack's own); a change to one of them is a new
`renderVersion`.

**Safe by construction, then checked.** Raw HTML in the source is dropped before it becomes markup, the URL policy runs last, and
KaTeX runs with `trust` off. Those are three options one edit could flip, so `render/safe` scans the rendered output with a parser
(parse5) against an allowlist, and `render/conformance` holds 44 hostile inputs every site runs against its own configured renderer:

```js
import { runConformance } from "@drdustinedwards/site-helpers/render/conformance";
const result = await runConformance((source) => render({ file: "x.md", body: source, resolveImage, options }));
// result.violations must be empty; result.elements and result.attributes say how much was read.
```

The allowlist (`render-allowlist.mjs`) is generated from the benign corpus in `test/fixtures/render/` by
`UPDATE_ALLOWLIST=1 npm test`, and a test fails when a tag or attribute is in the output and not the list, or in the list and never in
the output. A site that adds a pack with new markup passes `assertSafe` its own allowlist.

**`renderVersion`.** Bumped whenever the output changes for the same input. `test/render-golden.test.mjs` hashes the corpus output and
fails when it moves while `RENDER_VERSION` has not; `UPDATE_GOLDEN=1 npm test` rewrites `test/fixtures/render/golden.json` once the
version is bumped. A site stores the version beside its rendered HTML and re-renders on a mismatch.

**Measured limits.** The slowest hostile input is a bracket run: `[` repeated 20,000 times renders in about 0.15 s, 200,000 in about
1.6 s and 400,000 in about 3.4 s (Node 22, one core). The default `maxBytes` of 512 KB therefore does not by itself keep that case
out of a Worker; the number is the seat's to choose. `scanHtml` takes about 25 to 40 ms per 300 KB of output.

## The specimen

https://prelum.dustinedwards.info shows every element the pipeline renders, each short markdown source in `specimen/elements/`
beside its output, in both themes, in Capsomer's styling, with no script on the page. It renders with the configuration
dustinedwards.info uses (the core, `editorialPack` and `createHighlight`, with `assertSafe` on), shows each element's HTML and,
where it differs, its RSS form, and ends with one short post as a page, an RSS item and an llms.txt line. The footer names
Prelum's version from `package.json`.

`/elements.json` lists every element (id, name, summary, markdown, the pack it needs and its directives). It is generated from
`specimen/elements/` by the build and is what Carrel's Insert menu reads; nothing in it is written by hand. An element is one
file, `<order>-<id>.md`, with a `name` and `summary` header.

- `npm run specimen` builds the site into `specimen/dist`; `npm run deploy:specimen` builds and deploys it (a merge to `main`
  deploys it too, through `.github/workflows/specimen.yml`, once the Cloudflare secrets are set).
- `test/specimen.test.mjs` holds each element to its stored output in `specimen/expected/`, checks the elements cover every
  directive, chart type and highlighted language Prelum has, and builds the site to check the index, the footer and that no page
  has a generator tag or a script. `UPDATE_SPECIMEN=1 npm test` rewrites `specimen/expected/`; a changed file there is a change
  in what every site publishes, and goes with a `RENDER_VERSION` bump.
- Diagrams are drawn ahead of time by `npm run specimen:diagrams` (Mermaid's command line, in a browser) and committed in
  `specimen/diagrams/`; the build stops when one is missing.

## What it does not hold

These stay in each site:

- **Search behaviour.** Prelum escapes FTS5 queries and fuses ranked lists. Each site still decides which indexes it has, how it
  tokenizes, how it weights fields and what a result page shows.
- **Layouts.** No page, component or stylesheet lives here. The design system is Capsomer.
- **Frontmatter, media rules, long-date and the site's search visibility.** The pipeline renders a body; the site reads its own
  frontmatter and decides what a `/media/` URL is.
- **Ask.** Each site keeps its own question-answering feature, with its index, prompts and budget.

Runtime code that is not about publishing lives in `DrDustinEdwards/site-runtime`: security headers, the rate limiter, health, the
Access check and email.

## Tests

`test/fixtures/` holds each site's own published output, captured from germomics, foxhound and dustinedwards-info by
`scripts/capture-site-helper-fixtures.mjs` in dustinedwards-info. `PROVENANCE.json` lists the commits. `test/prelum.test.mjs`
holds the package to that output byte for byte. A change here changes what three sites publish, so it comes with a re-captured
fixture and a reviewed diff.

The tests exist to catch two defects in particular. One is an FTS5 term whose embedded quote is not doubled: the term escapes its
quotes and the query language reads the rest. The other is a fusion constant other than 60: every ranking shifts, with no error.

CI runs `npm run lint` (oxlint), `npm run typecheck` (tsc over the modules, their declarations and the tests) and `npm test` on
every pull request.
