# Changelog

## Unreleased

### Changed

- The specimen wears the family letterhead (Capsomer v0.28.1, `letterheadHtml`): the cerulean stripe over the band, the mark
  with "Dustin Edwards" over Prelum, and Home, Elements and Outputs in a second row, pinned at the top. It replaces the
  running head sign and the specimen's own skip link. The page has no script, so it follows the system's theme.
- The specimen's page is Capsomer's family column (Capsomer v0.29.0, `.cap-page`), so its letterhead, content and footer
  line up with every other family site. Its own 1180px width and `--header-max` are gone.

## 0.15.0 (2026-10-27)

### Added

- Search for a site with no database, in `search`: the build writes an index with `staticSearchIndex(pages)` (url, title,
  summary, headings, text) and the search page ranks it in the browser with `staticSearch(index, query)`. Every word must
  match (the last as a prefix), accents fold as `slugify` folds them, the title counts most, and a result links to the
  heading that matched. Capsomer's site is the first to use it; Enarratio's gallery and the specimen can follow.

### Changed

- The specimen's Worker is named `prelum`, after its site, as every family Worker is named after its product.
- The specimen takes the NASA manual theme the dustinedwards.info public pages share (Capsomer's `manual.css`), in its own family, cerulean: a running head as a sign, the facts in form boxes, the contents as a leader index, each element a numbered part and a letterhead at the foot. The diagrams are drawn in cerulean too (`diagramColors` lays `family-cerulean.css` over Capsomer's base colors). Rendered HTML is unchanged, so `RENDER_VERSION` stays 4.
- The specimen moves to Capsomer v0.22.0, the newest release.
- devkit v0.13.3, site-runtime v0.24.0 and Capsomer v0.23.0, the newest releases.
- The specimen ends with the family footer every dustinedwards.info site shares (Capsomer v0.27.0): Prelum's own part under a thin cerulean stripe, the Network strip of sites, then Dustin Edwards. It replaces the letterhead at the foot.

## 0.14.0 (2026-10-26)

### Added

- `searchTitle(title, suffix)` in `head`: the title with the site suffix where both fit in a search result, else the
  title alone, cut at a word. It moves here from dustinedwards.info so every site cuts long titles the same way.

### Changed

- `crawlSite` and `auditPages` skip links marked rel="nofollow", such as a footer sign-in link, so a link to a page
  behind a sign-in is no longer reported as a redirect.
- The specimen serves `/.well-known/security.txt` (site-runtime, security@dustinedwards.info), an IndexNow key file and a
  sitemap, and its deploy pings IndexNow with `prelum-indexnow`. A refused ping is only a warning.
- The repository runs devkit's family check and its no-bloat report (`npm run bloat`, a warning) in CI; site-runtime, a
  development dependency for the specimen, moves to v0.23.0.

## 0.13.0 (2026-10-25)

### Added

- `feeds`: an RSS item takes an optional `guid`, a permanent id stored at first publish, written `isPermaLink="false"`, so a
  changed slug does not announce the post again. Germomics' writing feed moves onto `rssDocument` with it.
- `render`: `resolveImage` may resolve `null` for an image the site stores no size for, which is then written unsized instead
  of failing the render, as `marked` wrote it. Foxing's journal moves onto Prelum's render with it. Output for every other
  input is unchanged, so `RENDER_VERSION` stays 4.

### Fixed

- The optional `puppeteer` peer is `^25.4.0`, no longer exactly 25.4.0, so a site that runs a newer Puppeteer 25 for its
  own tests (Enarratio) can install Prelum. Mermaid's CLI, the one user, takes any Puppeteer 23 to 25.

## 0.12.1 (2026-10-25)

### Fixed

- `head`: `truncateForSerp(text, limit)` now keeps its "..." inside `limit` (it could return `limit + 3` characters) and
  drops punctuation left before it, so a cut title no longer trips the audit's `title-long`.
- `audit`: titles, descriptions and attributes decode every numeric character reference (`&#x27;`, `&#8217;`) and
  `&nbsp;` in one pass, so an encoded apostrophe counts as one character and `&amp;lt;` stays `&lt;`.

## 0.12.0 (2026-10-25)

### Added

- `slug`: `slugify(text, { max })`, the one slug rule (accents folded, other runs one hyphen, none at the ends, cut to a
  whole word under `max`). Replaces the copies in dustinedwards-info, Carrel, Foxhound and Foxing.
- `xml`: `jsonLdText(value)`, the JSON-LD script text with `< > &` and U+2028/9 escaped, dustinedwards-info's serializer.
  `headHtml` now writes its JSON-LD with it, so `>` and `&` are escaped too; the data parses back unchanged.
- `indexnow`: `keyFileResponse(key, headers)`, the `/<key>.txt` file IndexNow fetches, written by hand in Foxing and Foxhound.
- `indexnow`: `recentSitemapUrls(xml, { days })` and the `prelum-indexnow` bin, so a static site tells IndexNow after a deploy:
  `prelum-indexnow --origin https://example.com --key <key> --sitemap dist/sitemap.xml` sends the pages whose lastmod is
  within two days (every page when the sitemap has none) and never fails the deploy. Carrel sites use site-api's
  `onPageChange` instead.

### Changed

- `xml`: `absolutiseUrls` is `absolutizeUrls`, in American spelling like the rest of the family. The old name stays as an
  alias, so no site breaks. So is `drawDiagrams`' `colours` option, now `colors`. <!-- codespell:ignore -->
- American spelling through the code, comments, docs and the specimen, and the specimen sends site-runtime's standard
  security headers (`buildSecurityHeaders`) instead of its own short list. The specimen reads Capsomer's `tokens/color.css`,
  or the older name from a Capsomer before 0.21.0. The corpus fixture's text changed, so its golden hash did; the renderer
  did not, so `RENDER_VERSION` stays 4.

## 0.11.0 (2026-10-25)

### Added

- `audit`: `crawlSite({ origin, fetch, maxPages, sitemapPath })`, the crawl for `auditPages`, with an injected `fetch` and no
  other I/O, so Capsid can run it on a schedule against each live site. It follows a sitemap index one level, fetches each URL
  with `redirect: "manual"` and follows up to five hops itself, then checks unlisted same-origin link targets by status (HEAD,
  or GET where HEAD is refused), at most `maxPages` (200) fetches. A failed fetch is a page with status 0 and its error.
- `auditPages` checks more: `canonical-elsewhere` (a sitemap page whose canonical names another URL), `X-Robots-Tag: noindex`
  on a sitemap page (with the meta tag, `sitemap-noindex`), `og-title-missing`, `link-redirect` (a link to a redirect),
  `fetch-failed` and `sitemap-empty`. A page takes `headers`, `redirectedFrom` and `error`; the site takes `sitemap`, the URLs
  the sitemap lists. A redirect chain is reported once, at its first URL, with every hop; a 200 page with no `html` (a
  status-only check) gets no head checks.

### Changed

- `auditPages` returns `{ findings, pages, summary }` instead of the findings array: `pages` is how many were audited and
  `summary` the findings per check. A canonical is compared by origin, so a relative one counts as on its page's origin.

## 0.10.0 (2026-10-25)

### Added

- `render`: `:::figure` takes a `dark` attribute, the same drawing for the dark theme. An SVG in an `<img>` cannot read the
  page's theme, so both images are in the HTML, `figure-light` and `figure-dark`, and the site's stylesheet shows one, as it
  does a diagram's. Neither half is wrapped in an `image-link` (the hidden one would be a focusable link with no name), and
  both load lazily, so the hidden one is never fetched. The dark file is collected into `mediaRefs` with the light one. For
  Foxhound's hand-drawn diagrams, which switch on the page's `data-theme`.
- `RENDER_VERSION` is 4. Output for a source without `dark` is unchanged; a source that wrote `dark` before had it ignored.
- Specimen: a figure with a dark twin.

## 0.9.0 (2026-10-25)

- Diagrams are drawn by shared code: `render/diagram-draw` (`drawDiagrams`, `pruneDiagrams`, `auditDiagramSvg`, `mermaidConfig`,
  `DIAGRAM_ROLES`, `DIAGRAM_ROLE_NAMES`) is the drawing step and color audit dustinedwards-info wrote in its
  `scripts/build-diagrams.mjs` and `scripts/lib/diagram-audit.mjs`, so each site gives only its colors, by role. `render/diagram`
  exports `DIAGRAM_ASSET_DIR`, `DIAGRAM_THEMES` and `diagramAssetPath`, which the site had copied. `@mermaid-js/mermaid-cli`,
  `puppeteer` and `linkedom` are optional peers. Rendered HTML is unchanged.
- Specimen: its diagrams are drawn with that code instead of Mermaid's command line, from Capsomer's tokens by role, so a box is
  the page's surface color with a strong line, as on dustinedwards-info.
- README: `/elements.json` is no longer said to feed Carrel's Insert menu, which keeps its own empty templates.

## 0.8.0 (2026-10-25)

### Added

- `robots`: `TDM_RESERVATION_HEADERS` (TDMRep `tdm-reservation: 1`, with no `tdm-policy`, since TDMRep reads a policy only as
  ODRL JSON or HTML) and `aiTxt`, Germomics' ai.txt in one form: answer engines may cite, training rights are reserved and
  licensed on request. A site's own policy lines are written as `#` comments, so edited text cannot add a directive.

## 0.7.0 (2026-10-25)

### Added

- `head`: `headTags` builds a page's title, description, canonical, Open Graph and Twitter tags (and `article:*` tags from
  `ArticleFacts`) as React Router meta descriptors; `headHtml` writes them as HTML for static builds, escaping attributes and
  `<` inside JSON-LD. Also `absoluteUrl`, `articleDates`, `truncateForSerp` and the SERP limits, from dustinedwards-info.
- `schema`: `jsonLd`, `thing` (any schema.org type, empty fields dropped), `graph`, `website`, `article`, `breadcrumbs`,
  `itemList` and `faqPage`, from the builders in dustinedwards-info, Foxing and Foxhound.
- `robots`: `robotsDocument`, with the disallow list repeated in every named group (Foxhound's fix), `Disallow: /` for a preview,
  and the family's bot lists (`SEARCH_ENGINE_BOTS`, `AI_SEARCH_BOTS`, `AI_TRAINING_BOTS`, `DENIED_BOTS`).
- `indexnow`: `submitIndexNow`, from Foxing and Foxhound: own-host URLs only, production origin only, never throws.
- `audit`: `auditPages`, a site audit's checks over crawled pages (titles, descriptions, canonicals, sitemap entries,
  redirect chains, broken links, JSON-LD, image `alt`, card images), with no HTML parser.

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
- Fixed: `createHighlight` passes shiki `tokenizeTimeLimit: 0`. Shiki's default stops tokenizing a line after 500 ms of wall-clock time and colors the rest of it as the last scope, so on a busy or cold machine (most often the first line, while Oniguruma compiles the grammar) a code block rendered to different bytes, and the golden test failed locally while CI passed. Now the output depends on the input alone. On a machine that never hit the limit nothing changes, so the golden hashes hold and `RENDER_VERSION` stays "3".

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

Three behaviors differ from dustinedwards-info's renderer, found in review, each with a test. None changes the output for content that
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
