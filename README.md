# Prelum

The shared publishing code for the Dustin Edwards sites (ruling capsid/rulings/shared-homes-2026-10-06.md): the code that turns a site's
content into the documents it publishes. This repository was `DrDustinEdwards/site-helpers` and was renamed, keeping its history and
tags. The package is still named `@drdustinedwards/site-helpers` and is installed by tag:
`"@drdustinedwards/site-helpers": "github:DrDustinEdwards/prelum#v0.3.1"`.

Pure ES modules, Web-standard only, so the same file runs in a Worker and in Node. The helpers have no dependencies; the markdown pipeline
needs the unified family, KaTeX and parse5, which are optional peers: a site that only builds feeds installs none of them.

## What it holds

The helpers every site wrote for itself, written once here in the form of the best of them:

| Module | Exports |
| --- | --- |
| `xml` | `escapeXml`, `cdata`, `rfc822`, `isoDay`, `absolutizeUrls`, `jsonLdText`, `mathToTex` |
| `slug` | `slugify(text, { max })` |
| `feeds` | `rssDocument`, `rssItem`, `atomDocument`, `atomEntry`, `jsonFeedDocument`, `feedItem` (`itemPath` moves where a post lives) |
| `sitemap` | `sitemapDocument(entries, { layout, lastmodFormat, trailingNewline })`; an entry's `images` list it in the image sitemap |
| `llms` | `llmsDocument`, `llmsLink`; `llmsFullDocument`, `markdownPage`, `markdownPath`, `prefersMarkdown`, `markdownResponse` (llms-full.txt and each page's Markdown copy); `llmsResponse` (the whole /llms.txt response) |
| `frontmatter` | `frontmatter(source)`: the `---` header of a Markdown file as `{ data, body }` |
| `head` | `defineHead(site)` (the per-site builder: `(page) => HeadTag[]`), `headTags(input)` (title, description, canonical, the Markdown copy's and the feeds' links, Open Graph, Twitter, `article:*`), `headHtml(tags)`, `metaText(html, limit)`, `readingMinutes(text)`, `absoluteUrl`, `articleDates`, `searchTitle(title, suffix)`, `truncateForSerp`, `SERP_TITLE_LIMIT`, `SERP_DESCRIPTION_LIMIT` |
| `schema` | `jsonLd`, `thing(type, fields)`, `graph`, `website`, `article`, `breadcrumbs`, `itemList`, `faqPage` |
| `robots` | `robotsDocument(input)`, `aiTxt(input)`, `robotsResponse(input)`, `aiTxtResponse(input)` (the whole responses), `plainTextResponse`, `isPreviewRequest`, `robotsNotes`, `PLAIN_TEXT_CACHE_CONTROL`, `TDM_RESERVATION_HEADERS`, `SEARCH_ENGINE_BOTS`, `AI_SEARCH_BOTS`, `AI_TRAINING_BOTS`, `DENIED_BOTS` |
| `indexnow` | `submitIndexNow(input)`, `keyFileResponse(key, headers)` (the `/<key>.txt` file), `recentSitemapUrls(xml, { days })`; the `prelum-indexnow` bin |
| `audit` | `auditPages(pages, { origin, sitemap })`, `crawlSite({ origin, fetch, maxPages, sitemapPath })` |
| `search` | `ftsLiteral`, `toMatchExpression`, `fuse`, `RRF_K` (D1's FTS5); `staticSearchIndex(pages)` at build and `staticSearch(index, query)` in the browser, `searchWords`, for a site with no database |
| `render`, `render/nomath` | `render`, `RENDER_VERSION`, `ContentError`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_DEPTH`, `isAllowedUrl` |
| `render/packs` | `editorialPack`, the `RenderPack` shape a site's own directives take |
| `render/highlight` | `createHighlight`, `LANGUAGES`, `SHIKI_THEMES` |
| `render/safe` | `assertSafe`, `scanHtml`, `inventory` |
| `render/conformance` | `HOSTILE_INPUTS`, `runConformance` |
| `render/math`, `render/url` | `htmlHasMath`, `KATEX_OPTIONS`; `isAllowedUrl` |
| `render/diagram` | `DIAGRAM_ASSET_DIR`, `DIAGRAM_THEMES`, `diagramAssetPath`: where a `:::diagram`'s drawings live |
| `render/diagram-draw` (Node, build time) | `drawDiagrams`, `pruneDiagrams`, `auditDiagramSvg`, `mermaidConfig`, `DIAGRAM_ROLES`, `DIAGRAM_ROLE_NAMES` |

## Search and AI crawlers

`head`, `schema`, `robots` and `indexnow` are what each site wrote for its own `<head>`, JSON-LD, robots.txt and IndexNow
pings, in one form. `headTags` returns the descriptor objects React Router's `meta` export takes, so a route returns it as it is;
a static build writes the same objects with `headHtml`. Each site keeps its own facts (who it is, its sameAs links, its default
card), and passes them in.

What they hold every site to:

- The canonical, `og:url` and every absolute URL come from the site's production origin, never the request's, so a workers.dev
  copy cannot claim to be the page.
- A card image is required, so `twitter:card` is always `summary_large_image`. An absent date writes no tag, and the Open Graph
  dates and the Article schema's come from one `articleDates`.
- `thing` drops empty fields, and `website` has no SearchAction without a real search URL: structured data claims nothing the
  page cannot back.
- robots.txt repeats the disallow list in every named group (a crawler uses only its own group), and a preview gets
  `Disallow: /`. `robotsResponse`, `aiTxtResponse` and `llmsResponse` (in `llms`) are the whole routes: given `{ origin,
  request }`, a request on any other origin is a preview (or pass `preview`), and the three files share one set of headers
  (UTF-8 text, an hour's cache or `no-store` on a preview, the TDMRep header, and `X-Robots-Tag: noindex` on ai.txt and
  llms.txt). The bot lists are the family's policy (Dustin, 2026-10-25): search engines and AI search bots are allowed;
  training bots are allowed so that they reach Cloudflare's Pay Per Crawl price, where AI Crawl Control charges or blocks them;
  Bytespider is denied.
- Training rights are reserved in the same words everywhere: every public response carries `TDM_RESERVATION_HEADERS`
  (TDMRep `tdm-reservation: 1`, the EU text-and-data-mining opt-out that a charge rests on), and `/ai.txt` from `aiTxt` says
  answer engines may cite and link while training needs a license. A site's own policy wording is written as comments only.
- IndexNow sends only the site's own URLs, only when the change came from the production origin, and never throws.

`audit` runs the checks a site audit leads with over pages a crawl already fetched (`crawlSite`, Cloudflare Browser Run's
`/crawl`, or a site's own test): missing, long or duplicate titles and descriptions; a missing canonical, one off the production
origin, or one that points away from a page the sitemap lists; a sitemap URL that redirects, is broken or is noindex (by meta tag
or `X-Robots-Tag`); redirect chains; links to broken pages or to redirects; JSON-LD that does not parse; images with no `alt`;
and pages with no `og:title` or card image. `auditPages` is pure and returns `{ findings, pages, summary }`, `summary` counting
findings by check.

`crawlSite` is the crawl, with its `fetch` passed in so a scheduled job (Capsid's, against each live site) runs it as it is and
a test fakes it. It reads the sitemap (a sitemap index one level down), fetches each URL with `redirect: "manual"` and follows up
to five hops itself so a chain is seen, then checks the status of every same-origin link target the sitemap left out (HEAD, or
GET where HEAD is refused), at most `maxPages` (200) fetches in all. A failed fetch is a page with status 0, never a throw. It
runs in a Worker or Node; a browser's fetch hides a manual redirect's status.

```js
import { auditPages, crawlSite } from "@drdustinedwards/site-helpers/audit";

const origin = "https://example.com";
const { pages, sitemap } = await crawlSite({ origin, fetch });
const { findings, summary } = auditPages(pages, { origin, sitemap });
```

## For agents: llms-full.txt and a Markdown copy of each page

After Cloudflare's Nimbus (MIT; its notice is in `llms.mjs`). A page's Markdown copy is `markdownPage({ title, url,
description, markdown })`: the title, the description as a blockquote, a `Source:` line and the body as the site stores it.
llms-full.txt is `llmsFullDocument`: llms.txt's own title, summary and intro, then every page as that same text, so the
two files and the `.md` copy cannot disagree.

A site serves the copy at `markdownPath(path)` (`/writing/post.md`, `/index.md` for home), and from the page's own URL when
`prefersMarkdown(request.headers.get("Accept"))` is true. Pass `markdown: markdownPath(path)` to `headTags` and the page links
it with `<link rel="alternate" type="text/markdown">`.

```js
import { markdownPage, markdownPath, markdownResponse, prefersMarkdown } from "@drdustinedwards/site-helpers/llms";

// In the page's loader and in its .md route:
if (prefersMarkdown(request.headers.get("Accept")) || url.pathname.endsWith(".md")) {
  return markdownResponse(markdownPage({ title, url: canonical, description, markdown: post.body }), { canonical });
}
```

`markdownResponse` sets `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept` and, with `canonical`, a
`Link: rel="canonical"` header, so search engines index the HTML page and not the copy. The page's HTML response needs
`Vary: Accept` too once its URL answers both ways.

## The markdown pipeline

Markdown in, a safe HTML fragment out (carrel/design-markdown-pipeline.md). It is dustinedwards-info's renderer, moved here so every
site that publishes Carrel's writing renders it the same way. The `render` import is deliberately light: it holds the parser, the
directives every site gets (`:::figure`, with a `dark` twin for a drawing that differs by theme, and `:::details`), math, the table of contents and the URL policy. What a site decides it injects:

```js
import { render } from "@drdustinedwards/site-helpers/render";
import { editorialPack } from "@drdustinedwards/site-helpers/render/packs";
import { createHighlight } from "@drdustinedwards/site-helpers/render/highlight";

const { html, toc, hasMath, mediaRefs, diagrams, blockedUrls, renderVersion } = await render({
  file: "content/posts/example.md", // for error messages
  body, // markdown with any frontmatter already stripped
  resolveImage, // async (src) => ({ width, height, placeholder? })
  options: {
    media: { keyOf, imageProps }, // the site's image rules; without them images are left as written. imageProps may return
                                  // sources (AVIF, then WebP) to wrap an image in <picture>
    packs: [editorialPack({ assetPrefix: "dustin-edwards-" })], // chart, diagram, sidenote, pullquote, swatch
    highlight: createHighlight({ wasm }), // without it a code block is plain <pre><code>
    maxBytes: 512 * 1024, // refused before parsing
    maxDepth: 100, // refused after parsing
    assertSafe: true, // scan the output and throw on anything outside the allowlist; off by default
  },
});
```

**A site with no math** imports `render` from `render/nomath` instead: the same pipeline and options, with `$` as plain text (so
`$3,000 to $6,500` is prices, not an expression) and `hasMath` always false. KaTeX, remark-math and rehype-katex are imported only by
`render`, so they never enter that site's bundle (about 1.6 MB raw) and need not be installed.

The output is a fragment: no `<html>`, no layout. A site gives it its own layout and its own CSS for the classes the pipeline emits
(`heading-anchor`, `table-scroll`, `image-link`, `post-details`, `figure-credit`, `figure-light` and `figure-dark`, and a pack's own); a change to one of them is a new
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

https://prelum.dustinedwards.info (not published yet: it goes up on the first deploy, below) shows every element the pipeline renders, each short markdown source in `specimen/elements/`
beside its output, in both themes, in Capsomer's styling, with the family letterhead's theme button (Capsomer's theme switch, bundled into `/theme.js` and
`/specimen.js`; no inline script). It renders with the configuration
dustinedwards.info uses (the core, `editorialPack` and `createHighlight`, with `assertSafe` on), shows each element's HTML and,
where it differs, its RSS form, and ends with one short post as a page, an RSS item and an llms.txt line. The footer names
Prelum's version from `package.json`.

`/elements.json` lists every element (id, name, summary, markdown, the pack it needs and its directives). It is generated from
`specimen/elements/` by the build; nothing in it is written by hand. (Carrel's Insert menu does not read it: its blocks are
empty templates with the cursor in `alt`, in `carrel/app/lib/site-markdown.ts`.) An element is one
file, `<order>-<id>.md`, with a `name` and `summary` header.

- `npm run specimen` builds the site into `specimen/dist`; `npm run deploy:specimen` builds and deploys it (a merge to `main`
  deploys it too, through `.github/workflows/specimen.yml`, once the Cloudflare secrets are set).
- `test/specimen.test.mjs` holds each element to its stored output in `specimen/expected/`, checks the elements cover every
  directive, chart type and highlighted language Prelum has, and builds the site to check the index, the footer and that no page
  has a generator tag or an inline script. `UPDATE_SPECIMEN=1 npm test` rewrites `specimen/expected/`; a changed file there is a change
  in what every site publishes, and goes with a `RENDER_VERSION` bump.
- Diagrams are drawn ahead of time by `npm run specimen:diagrams` and committed in `specimen/diagrams/`; the build stops when
  one is missing.

## Diagrams

A `:::diagram` holds Mermaid source and a required alt; the page shows a light and a dark drawing as two images. Mermaid lays
text out with a browser's font metrics, so the drawings are made ahead of time, in Node, by `render/diagram-draw`:
`drawDiagrams` runs Mermaid's own renderer (`@mermaid-js/mermaid-cli`, in Chromium through `puppeteer`) for each drawing that
is missing, with labels as SVG text (an `<img>` does not draw `<foreignObject>`) and an intrinsic size, and refuses any drawing
that paints a color outside the site's palette (`auditDiagramSvg`). A site gives one hex color per role in
`DIAGRAM_ROLE_NAMES` for each theme, and prunes the files `drawDiagrams` reports as stale by its own rules. Those three
packages are optional peers, needed only where drawings are made.

## What it does not hold

These stay in each site:

- **Search behavior.** Prelum escapes FTS5 queries and fuses ranked lists. Each site still decides which indexes it has, how it
  tokenizes, how it weights fields and what a result page shows.
- **Layouts.** No page, component or stylesheet lives here. The design system is Capsomer.
- **Frontmatter, media rules, long-date and the site's search visibility.** The pipeline renders a body; the site reads its own
  frontmatter and decides what a `/media/` URL is.
- **Ask.** Each site keeps its own question-answering feature, with its index, prompts and budget.

Runtime code that is not about publishing lives in `DrDustinEdwards/site-runtime`: security headers, the rate limiter, health, the
Access check and email.

## Tests

`test/fixtures/` holds each site's own published output, captured from germomics, foxhound and dustinedwards-info.
`PROVENANCE.json` lists the commits. `test/prelum.test.mjs`
holds the package to that output byte for byte. A change here changes what three sites publish, so it comes with a re-captured
fixture and a reviewed diff.

The tests exist to catch two defects in particular. One is an FTS5 term whose embedded quote is not doubled: the term escapes its
quotes and the query language reads the rest. The other is a fusion constant other than 60: every ranking shifts, with no error.

CI runs `npm run lint` (oxlint), `npm run typecheck` (tsc over the modules, their declarations and the tests) and `npm test` on
every pull request.
