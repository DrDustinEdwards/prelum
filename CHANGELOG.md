# Changelog

## 0.59.0

### Minor Changes

- `markdown-copy` reads the page with htmlparser2 and hastscript instead of `hast-util-from-html` (parse5), so a Worker that wraps itself in `markdownCopies` is about 30 KiB gzip smaller (julieedwards.info: 357.69 to 327.06 KiB) and the copy is made in about two thirds of the time. The Markdown is unchanged: the copies of eight live pages on julieedwards.info, dustinedwards.info and carrel.dustinedwards.info (the CV's 457 KB among them) came out byte for byte the same. A site using `markdownCopies` or `htmlToMarkdown` installs the optional peers `htmlparser2` and `hastscript`; `hast-util-from-html` stays a peer only for the render pipeline.

## 0.58.1

### Patch Changes

- The optional peer `hast-util-from-html` takes `^2.1.0` instead of exactly 2.0.3. 2.1.0 parses with parse5 8, the version Prelum already uses, so a site that installs it bundles one parse5 and one `entities` instead of two of each (dustinedwards.info's Worker: about 47 KiB gzip less). An exact pin on a peer forced every site onto 2.0.3; the range lets a site take a fixed or deduplicated release without waiting for Prelum.

## 0.58.0 (2026-11-13)

No change to `render` or RENDER_VERSION. Additive.

- **`./frontmatter`: `blocks`, `unquote`, `withoutComment` and `splitFlow` are exported**, the pieces `readKey`, `readList` and `setBlock` already read with. Capsomer's frontmatter fields kept its own copy of each (`blocksOf`, `unquoteItem`, `outsideQuotes`/`hasComment`, `readFlowItems`) to type a block into a box; it imports these instead once this is released.

## 0.57.0 (2026-11-13)

No change to `render` or RENDER_VERSION. Additive.

- **Enarratio 0.15 is supported.** The `enarratio` peer range adds `^0.15.0` (0.15.0 adds `enarratio/lite/sparkline`). The suite and the goldens pass unchanged on 0.15.0, which is now the dev dependency, so a chart's rendered HTML does not change.

## 0.56.0 (2026-11-13)

No change to `render` or RENDER_VERSION. Additive.

- **`./matter`: `matter(source)` and `stringifyMatter(content, data)`**, YAML frontmatter as a whole mapping, in place of gray-matter. gray-matter's js-yaml 3 imports esprima (135 KB in a Worker bundle, which UMD keeps whole) and `eval`s; this reads with the `yaml` package (YAML 1.2 core plus the timestamp tag), so a bare date is still a `Date` and `yes`, `1:30` and `0777` are no longer guessed. The fences, BOM, CRLF and the content after the closing line read as gray-matter's did (all 269 Markdown files of dustinedwards.info parse identically). A duplicate key, unreadable YAML or a header that is not a mapping throws. `yaml` is a new optional peer dependency (2.9.1), needed only by a site that imports `./matter`. `./frontmatter` is unchanged: it reads text blocks with no parser.

## 0.55.0 (2026-11-13)

No change to `render` or RENDER_VERSION. Additive.

- **`./text`: `normalizeHex(hex)`**, `#abc` or `#aabbcc` as lowercase `#aabbcc`, the one copy. The diagram audit (`render-diagram-draw.mjs`) had its own, which expanded a 3-digit hex but neither trimmed space nor accepted a missing `#`; Capsomer's `token-check` had the other. This is Capsomer's behavior (the more tolerant one), and `render-diagram-draw` now imports it. Capsomer drops its copy and imports this.
- **Specimen builds with `capsomer/build`**: `specimen/build.mjs` drops its own `inlineCss`, stylesheet assembly and Rolldown bundler for Capsomer's `capsomerStylesheet`, `copyFonts` and `bundleScript`, and takes Source Serif 4 from Capsomer's fonts (the latin core file is the one preloaded), so `@fontsource-variable/source-serif-4` goes. Capsomer v0.126.0 (dev dependency) needs `lightningcss` as a peer, added as a dev dependency. No change to the package's own modules.

## 0.54.0 (2026-11-12)

No change to `render` or RENDER_VERSION. Additive.

- **`./text`: `formatCount(n)`, `capitalize(text)`, `titleCase(text)` and `humanize(text)`**, the label rules Foxhound, txasm and Foxing each wrote inline (about twenty copies). `formatCount` is en-US grouping (1,204), which `plural(..., { grouped: true })` now calls. `titleCase` capitalizes every word of a slug or snake_case value ("payment_recovery" is "Payment Recovery"); `humanize` writes it as a sentence ("insufficient_funds" is "Insufficient funds"). Both treat runs of `_`, `-` and spaces as one break and drop empty words.

## 0.53.0 (2026-11-12)

No change to `render` or RENDER_VERSION. Pins site-runtime v0.143.0 (peer `>=0.143.0`) and devkit v0.39.0; shared-code sweep leftovers.

- **Breaking: `sitemapLocs` is no longer exported from `./markdown-copy`.** Import it from `@dustinedwards/site-runtime/html`, which now holds the one reader of a sitemap's `<loc>` addresses (trimmed, entity-decoded).
- **`./sitemap`: `sitemapEntries(xml)`**, the `{ loc, lastmod }` of every `<url>` or `<sitemap>` in a sitemap or index. `crawlSite`'s sitemap reader and `recentSitemapUrls` (`./indexnow`) shared a hand-written copy each; both use it now. `recentSitemapUrls` still gives nothing for a sitemap index.
- `auditPages`/`crawlSite` read attributes and entities with site-runtime's `htmlAttributes` and `unescapeHtml` instead of their own copies. A repeated attribute now keeps its first value (as a browser does), not its last.
- The writing audit (`prelum-audit` writing checks) reads an image's `alt`, `width` and `height` with `htmlAttributes`: an `alt` written with no value counts as present and empty (as in HTML), and values are entity-decoded.
- The `:::chart` CSV (`render-chart.mjs`) is read with site-runtime's `parseCsv` (fields trimmed and blank lines skipped here, as before) instead of a second RFC 4180 state machine.
- Link icons (`render-link-icons.mjs`) take the PNG CRC-32 from site-runtime's `crc32`.

## 0.52.1 (2026-11-12)

No change to `render` or RENDER_VERSION.

- `ARTICLE_IMAGE_RATIOS` (`./schema`) is site-runtime's `./image` constant re-exported, the same `["16x9", "4x3", "1x1"]`, instead of a second definition.
- `accessibilityStatement`'s HTML copy escapes text with site-runtime's `escapeHtml` instead of its own `esc`. The one difference is that an apostrophe in text the site passes is written `&#39;`, which renders the same.

## 0.52.0 (2026-11-12)

No change to `render` or RENDER_VERSION.

- **`./slug`: `uniqueSlug(text, { taken, fallback, max, tries })`**, a slug for a new row that no other row holds. With `taken` (the site's lookup, sync or async) it tries the base, `base-2`, `base-3` ... up to `tries` (100), then a random six-character a-z0-9 suffix; without `taken` it always adds the suffix. The result stays within `max` (SLUG_MAX_LENGTH) and SLUG_PATTERN. From Foxing's `uniqueSlug` (always a suffix, nanoid), Foxhound's `uniqueSlugFromTitle` and germomics' people `uniqueSlug` (counted, with a UUID or `Date.now()` fallback that could exceed the length limit).

## 0.51.0 (2026-11-11)

No change to `render` or RENDER_VERSION.

- **`./scholar`: `escapeBibtex` and `bibtexPages` are exported, and `toBibtex` writes a page range with `--`.** BibTeX wants `100--110`; a verbatim `100-110` is a minus sign in a typeset reference. `bibtexPages` turns every hyphen or dash run between numbers into `--` (an article number such as `e12345` is unchanged), and `toBibtex` uses it. dustinedwards.info's CV and protocol writers had their own BibTeX that fixed only the first hyphen and escaped nothing; they move onto these.

## 0.50.0 (2026-11-11)

No change to `render` or RENDER_VERSION.

- **Breaking: `enhance()` (`./render/enhance`) draws no reading progress bar.** The bar is Capsomer's reading progress (`capsomer/reading-progress.css`, Capsomer 0.99.0): CSS only, a scroll-driven animation on the article's view timeline, with no scroll listener. A site that called `enhance()` and styled `.reading-progress` renders `<div class="cap-reading-progress" aria-hidden="true"></div>` and marks its article `data-cap-reading` instead. The `article` option now only scopes the selection link.

## 0.49.0 (2026-11-11)

Shared-code audit item 49, second part. No change to `render` or RENDER_VERSION.

- **Search (`./search`)**, from dustinedwards.info's app/lib/search: `parseQuery(input, { operators, minYear, maxYear })` (quoted phrases, then `name:value` operators, then a bare year as a date filter, then terms), `hasFilters`, `parseSort` and `applySort` (relevance by default; date puts undated hits last), `isPubliclyVisible` and `PUBLISHED_STATUS` (a `publishAt` that does not parse is not public), and `normalizeZeroResultQuery` with `ZERO_RESULT_MAX_LENGTH` (a no-result search a site may keep, refused when shaped like an address, a phone number or a name). The site's operators are passed in: dustinedwards.info's `tag`, `type` and `base` arrive under `filters.tag`, `filters.type` and `filters.base` instead of `tags`, `types` and `bases`.
- **HTML site map, new `./site-map`**, from dustinedwards.info's app/lib/site-map.mjs: `siteMapSections(urls, sections)`, `sectionOf(path, sections)` and `lineText`. The sections are the site's own (an id, a heading, a hub and the address prefixes it owns; the last is the catch-all). A counted kind with no index of its own is plain text, so no two links with different text go to one place (WCAG 2.4.4).
- **Stored HTML, new `./stored-render`**, from germomics' app/lib/render.server.ts: `storedRender(stored, { render, current, onError })` shows a stored render at this release, renders an older one in memory, and keeps the last stored HTML when the body no longer renders; `rerenderEach(rows, { render, save, onError })` renders and saves each row so one failure never stops the rest; `wrapRendered(html, version)` and `RENDER_VERSION_ATTRIBUTE` are the `data-render-version` wrapper render-audit reads.
- **Markdown source, new `./source`**, from Carrel's lib/chart-block.ts, lib/site-markdown.ts and lib/seo-checks.ts: what an editor writes and checks in Prelum's dialect. `chartBlock(fields)`, `chartBlocks(body)`, `csvColumns(csv)` and `CHART_KINDS` for `:::chart`; `figureMarkup(url, alt, { caption, figure })` for `:::figure` (a decorative image, empty alt, is always plain `![""](url)`, the one form the renderer reads as decorative); `imagesWithoutAlt(source)` (Markdown, `<img>` and `:::figure`, code skipped) and `isAbsoluteHttps`. Carrel's per-site field names and its draft messages stay Carrel's.
- **Text and citation helpers (pass2 audit targets).** `./text`: `plural(count, one, many, { grouped })` (21 inline `=== 1 ? "" : "s"` in Carrel, four helpers in dustinedwards.info, more in Foxhound), `normalizeNewlines` (CRLF and lone CR; 27 inline copies in Carrel), `mdCell` (a GFM table cell: pipes escaped and line breaks as spaces, where dustinedwards.info's five copies escaped only the pipe) and `escapeMarkdown` (with Prelum's `:word` directive guard). `./scholar`: `DOI_PATTERN` (four copies in dustinedwards.info) and `doiSlug`.
- The site-runtime peer range is `>=0.117.0`, the first with `./csv`'s `parseCsv`.

## 0.48.0 (2026-11-11)

Shared-code audit item 49, first part. No change to `render` or RENDER_VERSION.

- **`submitIndexNowIfChanged`** (`./indexnow`), from Foxing's sitemap: submits a page set only when it differs from the one last submitted, for a sitemap that rebuilds the whole set on each request. The sorted set's SHA-256 (site-runtime's `sha256Hex`) is kept in KV under the site's `hashKey`, and it is written only after the submission went, so a failed ping is tried again on the next request; Foxing wrote the hash first, so one failed ping lost that change until the set changed again. Never throws, as `submitIndexNow`.
- **Not in this release** (item 49's other parts): the search engine and the HTML site map from dustinedwards.info, the stored-HTML re-render from germomics, and Carrel's chart and figure writers and SEO checks.
- **The specimen enforces Trusted Types.** site-runtime 0.132.0 (dev dependency) moves `require-trusted-types-for 'script'` from the specimen's Report-Only policy into its enforced one (`site-runtime-headers` writes it into `_headers`). No change to the library or RENDER_VERSION.

## 0.47.0 (2026-11-11)

Shared-code audit items 46 to 48. No change to `render` or RENDER_VERSION.

- **Head (item 46).** `rootLoaderData` and `privateMeta` were added in 0.43.0; the last copy, foxing's `buildMeta`, is `defineHead` with three additions. `SiteHead.description` is the default description for a page that passes none, `SiteHead.wholeHomeTitle` makes the home page's `title` the whole `<title>` (no suffix), and `PageHead.imageAlt` is the alt of the page's own `image` (a URL, or an object with no `alt`). `PageHead.description` is now optional. A path's trailing slash was already dropped for the canonical; it is now dropped from the path `defineHead` passes on too, unless `keepTrailingSlash`. No site-specific head wrapper is left to share (txasm's `pageTitle` and `titleSuffix` are its own settings).
- **Schema builders (item 47), `./schema`.** `person`, `organization`, `softwareApplication`, `podcastSeries`, `podcastEpisode`, `postalAddress`, `sameAs`, `scholarlyArticle` and `scholarlyType`, from germomics, Foxhound and dustinedwards.info. All of them drop empty fields, as `thing` does. `sameAs(urls)` keeps absolute http(s) URLs, trimmed and once each, and is undefined when none are left. A name given where an organization or a person is wanted is written as one. `podcastEpisode` writes the length as `duration` (an ISO 8601 duration) on the episode and on its audio file: schema.org's Episode and MediaObject both take `duration`, and `timeRequired` is for reading time, which germomics used. `scholarlyArticle` is dustinedwards.info's paper node (the DOI as `identifier` and `sameAs`, the journal as a Periodical with volume and issue nested, a hosted PDF as `encoding`); a site passes `context.author` to write its owner as an `@id` reference and keep the co-authors.
- **Citation formats (item 47), `./scholar`.** `toBibtex`, `toRis`, `coinsTitle`, `citationTags` and `REQUIRED_CITATION_TAGS` from dustinedwards.info. The site's alias table is passed as `author` and the terms BibTeX must not lowercase as `protect` (group 1 is braced). `coinsTitle` follows ANSI/NISO Z39.88 (OpenURL): a chapter is genre `bookitem` and a teaching resource `document`, both in the book format (`rft_val_fmt=info:ofi/fmt:kev:mtx:book`, the title as `rft.atitle` and the book as `rft.btitle`; a document's title is `rft.btitle`), where dustinedwards.info wrote every work in the journal format. Articles, reviews and abstracts (`conference`) are unchanged. Character references are decoded with `unescapeXml`, not a second decoder.
- **Text (item 48).** `hasWideDash(text)` (`./text`) is the yes-or-no form of `findWideDashes`, over the same U+2010 to U+2015 and U+2212; dustinedwards.info's own check covered only U+2013 and U+2014. `readingMinutes(words, images, wordsPerMinute)` takes a site's own pace. Reading time stays 238 words a minute (Brysbaert's 2019 meta-analysis of silent reading of non-fiction, the cited research) with Unicode word counts; dustinedwards.info's 200 words a minute and whitespace count restate its published times, so that site either moves to the shared pace on its next regeneration or passes `200`. Capsomer's `countWords` and `minutesForWords` (200, the Markdown editor's live count) are Capsomer's and are left to it. `SLUG_MAX_LENGTH` (120) and `SLUG_ATTRIBUTE_PATTERN` (`SLUG_PATTERN` without its anchors, for an `<input pattern>`) join `slugify`, `SLUG_PATTERN` and `isSlug`, replacing dustinedwards.info's `slug.mjs`; Carrel's `slugFor` and germomics' `slugifyGuest` are `slugify`, which also folds accents (a germomics guest named José is `jose`, where its rule kept the accented letter).
- **WebVTT, new `./vtt`.** `parseVtt`, `transcriptText`, `transcriptDuration`, `isVtt`, `toParagraphs`, `srtToVtt` and `parseCueText`, from germomics' `vtt.ts` and Carrel's `parseTranscript`. `parseVtt` follows the W3C WebVTT grammar (https://www.w3.org/TR/webvtt1/): the timing line is the first line of a block or the second after an identifier, hours are optional, minutes and seconds are two digits and milliseconds three after a dot (a comma is SRT, which `srtToVtt` converts), NOTE, STYLE and REGION blocks and cue settings are skipped, markup is dropped from the text, the character references the format allows (`&amp;`, `&lt;`, `&gt;`, `&lrm;`, `&rlm;`, `&nbsp;`) are decoded, and a `<v Name>` voice tag is the cue's `speaker`. germomics accepted one-digit hours and comma timestamps and Carrel required two-digit hours; both read a valid file the same way.
- **Left to the others.** Carrel's chapter placing and transcript diff, dustinedwards.info's `exportHeaders`, `toBibtexAll` and `toRisAll` file headers, its alias table and organism pattern, germomics' footer `socialLinks`, and Foxhound's copy and `knowsAbout` lists stay with their sites; they are data and wiring around the shared builders.

## 0.46.1 (2026-11-11)

- **Enarratio 0.13 is supported** (peer range `^0.13.0` added) and 0.13.1 is the tested version. Its phone-width layouts change the drawings but not the markup this library allows, so the 213 tests pass unchanged and `RENDER_VERSION` stays 25.

## 0.46.0 (2026-11-11)

- **Enarratio 0.12.2 is the tested version.** Its toolbar icons are inline `<svg class="enarratio-icon">` elements, not `<span data-icon>`, so a chart's rendered HTML changes and `RENDER_VERSION` is 25: a site re-renders its stored HTML. The render allowlist drops `span data-icon` and adds `svg class`, `svg aria-hidden` and `svg focusable`; the goldens and the specimen's chart outputs are regenerated. The chart audit's planted heavy chart puts its weight in the drawing, since the first `</svg>` is now an icon's.
- **The specimen deploy's live gate runs again.** Every devkit workflow call moves from v0.27.0 to v0.33.0, whose worker-deploy sets `DEVKIT_DIR` for the verify command; v0.27.0 never set it. No change to the library.

## 0.45.0 (2026-11-11)

- **`SLUG_PATTERN`** and **`isSlug`** (`./slug`), beside `slugify`: the one slug rule as a pattern and a check, for the copies of `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` in Carrel, dustinedwards.info, Foxhound and site-api, and for Capsomer's `SlugField` (shared-code audit pass 2, C14). No change to `render` or RENDER_VERSION.

## 0.44.0 (2026-11-11)

- **site-runtime is a peer dependency** (`>=0.113.0`): the diagram file names use its `fnv1a32` and `errorMessage` is its `./log` one, re-exported from `./render-error`, so neither is a copy (devkit-shared). Every site and package that uses Prelum already has it.
- **`standardFiles`** takes `manifest` as a function too, as `ai` already did, for a site whose name and description live in its content (julieedwards.info reads them from D1).

## 0.43.0 (2026-11-11)

- **`standardFiles`** (`./files`): robots.txt, ai.txt, site.webmanifest, the IndexNow key file and search engines' ownership files from one config, answered before React Router, so no site writes their routes (shared-code audit items 44 and 45).
- **`sitemapResponse`**, **`feedResponse`** with **`FEED_CONTENT_TYPES`**, **`webManifestResponse`** and **`verificationFileResponse`**: the response wrappers each site wrote around the documents. `documentResponse` (`./xml`) is the one they share.
- **`rootLoaderData`** and **`privateMeta`** (`./head`), from txasm and julieedwards.info.
- **`findWideDashes`** (`./text`), the house no-wide-dash check from dustinedwards.info.
- No change to `render` or RENDER_VERSION.

## 0.42.0 (2026-11-11)

- **The web app manifest has an `id`.** `webManifest` writes `id` (`"/"` unless the site passes one), so an installed app keeps its identity when `start_url` changes (W3C Web App Manifest, the id member; Chrome's Modern Web Guidance, install-web-app). `auditIcons` warns on a manifest with no `id`. A site's `/site.webmanifest` gains one line on the bump; nothing else changes.
- **The page audit asks for the text-scale opt-in.** `auditPages` warns (`text-scale-missing`) on a page without `<meta name="text-scale" content="scale">`, which lets Chrome and Edge 146 on phones scale `rem` sizes with the reader's system text size (Chrome's Modern Web Guidance, respect-os-text-scale; other browsers ignore it). The specimen opts in. No change to `render` or RENDER_VERSION.

## 0.41.4 (2026-11-11)

- **Enarratio 0.11 and 0.12 are supported.** The `enarratio` peer range adds `^0.11.0 || ^0.12.0`. 0.11 puts the chart toolbar above the drawing and keeps the data table visually hidden after it; 0.12 draws solid bars and areas with the series named on the chart, values at bar tips and rounded bar tops. A chart's rendered HTML changes, so `RENDER_VERSION` is 24: a site re-renders its stored HTML. The render allowlist is regenerated from the corpus (bars are now paths, new `data-enarratio-at` and `data-enarratio-shown` attributes, the toolbar's buttons), and the chart audit's planted "no table" charts now remove the hidden table instead of the old "Show data" disclosure. The specimen and the dev dependencies move to enarratio 0.12.0.

- **The specimen's diagram is drawn in the page.** Draft, Prelum and Page are one inline SVG (`figure.blog-diagram`, with `title` and `desc`), filled from the page's color variables, so the same drawing follows light and dark. The Mermaid files `specimen/diagrams/prelum-03318765-light.svg` and `specimen/diagrams/prelum-03318765-dark.svg` are removed. `:::diagram`, `drawDiagrams` and `renderDiagramHast` are unchanged, and `RENDER_VERSION` is unchanged.

## 0.41.3 (2026-11-08)

- **Enarratio 0.10.0 is supported.** The `enarratio` peer range adds `^0.10.0`. Its figures carry a `lang` attribute and name their data-table scroll region, so a chart's rendered HTML changes and `RENDER_VERSION` is 23: a site re-renders its stored HTML. The specimen and the dev dependencies move to enarratio 0.10.0 and site-runtime 0.101.3.

- **The specimen is on Capsomer 0.84.0.** Its `base.css` names an `aspect-ratio` for an `img` with `width` and `height`, which clears Chrome's `LazyLoadImageIssue` for the specimen's lazy images (11 flagged before, 0 after). Specimen only; no change to `render` or RENDER_VERSION.

## 0.41.2 (2026-11-07)

- **The accessibility statement says what was checked.** `HAND_CHECK_LIMITATIONS` no longer says screen-reader testing is unfinished; it says no screen reader has been run and that pages are scanned automatically and reviewed for structure and keyboard use. No change to `render` or RENDER_VERSION.

## 0.41.1 (2026-11-07)

- **An empty header cell is a `td`.** The empty top-left cell of a comparison table (`|  | A | B |`) was a `th` with no name: axe `empty-table-header`, and a screen reader announced the column with nothing. W3C WAI's tables tutorial treats a corner that names nothing as a plain cell, so it renders as `<td>`. The rendered HTML changes for such tables, so `RENDER_VERSION` is 22 and a site re-renders its stored HTML.

## 0.41.0 (2026-11-07)

- **`scanLimits`** (`render` option, `DEFAULT_SCAN_LIMITS` export) sets the pre-parse limits on reference links (2,000), emphasis marks (8,000) and `[` (10,000). They were fixed, and a reference page of `snake_case` names could exceed the emphasis one: every `*` and `_` counts, in an inline code span too (fenced code is skipped). The error names the option. A limit you raise is the quadratic cost you accept.
- **A sitemap `priority` finer than 0.1 throws** (0.25 was silently written as 0.3). Prelum already throws on a priority outside 0 to 1 rather than fix it up, and the sitemaps.org protocol says one decimal.
- **`unescapeXml` decodes numeric character references** (`&#38;`, `&#x26;`), which other sitemap and feed generators write. One XML 1.0 forbids (`&#0;`, a surrogate, past U+10FFFF) or an unfinished one stays as written.
- The 2048 x 2048 pixel limit on a PNG link icon (0.40.1) stays fixed: favicons and touch icons are far smaller, and a larger one is what the limit exists to refuse.

- `renovate.json` no longer carries its own rule against rewriting peer ranges; the shared preset (devkit) applies it to every repository.

## 0.40.1 (2026-11-07)

- **Two code blocks or tables with one name no longer share a landmark name.** Each scrollable region is a `role="region"` named "Code: Bash" or "Table: …"; a page with two of the same name failed axe `landmark-unique` and gave a screen reader two identical landmarks. A name used more than once now ends " (1 of 2)", " (2 of 2)"; a name used once is unchanged. The rendered HTML changes for such pages, so `RENDER_VERSION` is 20 and a site re-renders its stored HTML.
- **Hardening, and `RENDER_VERSION` is 21.** The output changes only where a page hit one of these: a heading id that duplicated another (below), a pull-quote page's `words` and `excerpt`, and a URL attribute that is now dropped.
- A source under the byte cap that exhausted time or the stack is refused fast with a `ContentError` (`[a][a]` x 300 KB took 46 s; `_a`, `>` and `> ` runs threw a raw `RangeError`). A pre-parse scan refuses more than `maxDepth` block-quote or list markers in a row, a list indented past `maxDepth` levels, and, outside fenced code, more than 2,000 reference links (`][`), 8,000 `*`/`_` marks or 10,000 `[`. Any `RangeError` from parsing is a `ContentError` too.
- `fitLinkIcon` returns `null` for a PNG that declares more than 2048 x 2048 pixels or inflates past its declared size, before allocating (an 8000 x 8000 gray PNG of 62 KB took 7 s and 440 MB). Its type is now `... | null`.
- `assertSafe: true` accepts ordinary KaTeX output (`\mathbb{R}`, `\hat{x}`, `\sqrt[3]{x}`, `\binom{n}{k}`, `\boxed{x}`, `\xrightarrow{f}` and the rest): `menclose`, `mover`, `mpadded`, `mphantom`, `mroot`, `mspace`, `munder` and their attributes, regenerated from the corpus, which now holds them. Script and foreign content stay blocked.
- An SVG icon with a prefixed element (`<svg:script>`), a CSS escape or a `&#` reference is refused. Icon fetches follow redirects by hand (at most 3), checking each hop before requesting it, and refuse IP-literal hosts and `.nip.io`, `.sslip.io`, `.localtest.me`, `.lan`, `.corp` (with `.localdomain`, `.intranet`, `.private`) names.
- Whitespace-only text no longer counts as present: `:::figure` `alt`, `:::details` `summary`, `:::video` and `::embed` `title`, `:abbr` `title`. A `silent` video needs a description as its content (WCAG 1.2.1: video-only has no other text alternative).
- A heading never takes an id already used by a sidenote (`sn-1`) or the footnotes heading (`footnote-label`): the heading becomes `sn-1-1`, `footnote-label-1`.
- The pull quote's aria-hidden copy no longer counts in `words`, and is not taken as the `excerpt`.
- The URL protocol guard covers every URL attribute on every element (`poster`, `srcset`, `action`, `formaction`, `data`, `cite`, `xlink:href`, ...), not only `a href` and `img src`; a blocked one is dropped and listed in `blockedUrls`.
- `::bookmark` with an unparseable URL is a `ContentError`, not a `TypeError`.
- `enhanceEmbeds` gives the player iframe `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`, and the heading-link copy handler leaves a modified or non-primary click to the browser.
- Chart CSV reads a quoted field that holds a line break and drops a leading byte order mark. A chart `src` with a `..` segment, a backslash, a control character or a scheme but http(s) is refused before the site's `chartData` loader; the loader still receives the author's text and must validate the rest (README, Charts in posts).
- `LICENSE` (MIT, as `package.json` already said) and `SECURITY.md` are in the repository. Without a license file GitHub showed none and the MIT grant was not in the source.
- `escapeXml` and `cdata` drop the characters XML 1.0 forbids (U+0000-0008, 000B, 000C, 000E-001F, FFFE, FFFF), which made a feed or sitemap unreadable. `unescapeXml` is new: the five entities back to characters.
- A date string with a `T` and no zone is UTC on any machine, and one with an offset but no `T` (`2026-06-21 09:30:00+02:00`) parses instead of being invalid.
- `absolutizeUrls` rewrites single-quoted attributes too, and only inside real tags, not in escaped code samples or comments.
- The audit reads a quoted attribute value whole when it holds a `>` (`content="Fish > chips"`).
- `submitIndexNow` sends at most 10,000 URLs a POST and accepts an origin with a trailing slash; `recentSitemapUrls` decodes all five XML entities.
- `sitemapLocs`, `writeMarkdownCopies` and `writeSitemapLastmod` decode XML entities in sitemap addresses, so a URL with `&` matches its page. A Markdown copy keeps blank lines inside fenced code, and a malformed canonical link is ignored instead of throwing.
- `htmlToText` no longer puts a space where an inline tag was (`<b>world</b>.` reads `world.`); block tags and `<br>` still separate words. `isoDuration(0.4)` is undefined, not `PT`.
- `toMatchExpression` drops terms with no letter or digit and strips NUL from terms.
- Frontmatter reads an empty header (`---` then `---`), a leading byte order mark, quoted commas in a flow list (`["a, b", c]`) and drops a trailing YAML comment (`draft: true # wip`).
- `llmsHeaderOf` neither repeats the title as intro nor leaves an empty `> ` line when the file has no summary; `llmsDocument` and `llmsFullDocument` flatten newlines in the title and summary and write no `>` line for an empty summary; `llmsLink` percent-encodes spaces and parentheses in the URL.
- JSON Feed items use `guid` as `id` when given, as RSS and Atom do, and `feedItem`'s types mark `summary`, `date_published`, `date_modified`, `tags` and `image` optional.
- `slugify` with `max` cuts at a whole word, and transliterates ß, ø, æ, œ, đ and ł.
- `sitemapDocument` throws on a `priority` outside 0 to 1 or a `changefreq` outside the sitemaps.org values, and writes at most 1,000 images a URL. `priority` is still written with one decimal.
- `absoluteUrl` turns a protocol-relative `//cdn.example/i.png` into `https://cdn.example/i.png`.

## 0.40.0 (2026-11-07)

- **Breaking: `enhance()` no longer opens images in a viewer.** The lightbox (`a.image-link` and `img.diagram-image`) and the diagram zoom moved to Capsomer 0.81 (`capsomer/behavior/lightbox`, with `capsomer/lightbox.css`), so every site has one viewer. A site that called `enhance()` for it marks its content `data-cap="lightbox"` and calls Capsomer's `enhance()`. The markup this package writes (`a.image-link`, `img.diagram-image`) is unchanged.

## 0.39.1 (2026-11-07)

- The `enarratio` peer range is `^0.7.3 || ^0.8.0 || ^0.9.0` again. Renovate had pinned it to the dev version (0.8.0), so a site on Enarratio 0.9 could not install Prelum without an override. Renovate no longer touches peer ranges here (`renovate.json`), and the dev copy is Enarratio 0.9.1.

## 0.39.0 (2026-11-07)

- `markdownCopies` takes `siteMarkdown: false` for a site that answers no `.md` path itself. The wrapper then makes the copy without first asking the site for it, so a site that counts its 404s no longer counts every `.md` request as one. The default is unchanged.

## 0.38.0 (2026-11-07)

- `pageDates` and `readPageRecord` (`/lastmod`) give a static build's sitemap an accurate `lastmod` for every page: a page whose text matches the live
  build's record keeps that record's date, and a changed or new page gets today's. Capsid's explorer had this as a local copy.
- `prelum-lastmod` (`writeSitemapLastmod` from `/markdown-files`) runs it over a static site after `prelum-markdown`: each sitemap URL gets the day its Markdown copy last changed, and `build.json` carries the record to the next build.
- `trackPageDates` and `kvPageRecord` do the same for a rendered site's code-backed pages (the ones no database row dates): a cron job reads each as Markdown, hashes it, and keeps the date of every page whose text is unchanged in one KV key.

## 0.37.1 (2026-11-07)

- The footnote preview (`enhance`) copies the footnote node by node instead of assigning `innerHTML`, so a page that requires Trusted Types
  (`require-trusted-types-for 'script'`) takes it and Chrome logs no CSP issue. The preview is the same.

## 0.37.0 (2026-11-07)

- `markdownCopies` takes `llmsFullSkip(path)`: pages that get a Markdown copy but stay out of the llms-full.txt it builds, such as a
  catalog of thousands of records that an agent fetches one at a time. Nothing else changes.

## 0.36.0 (2026-11-07)

- `prelum-audit` and `auditPages` check more of what Google and Bing document: `html-lang-missing`, `viewport-missing` and
  `h1-missing` (warnings); `canonical-multiple` (error: two different canonicals and Google ignores both) and
  `og-url-mismatch` (warning); `jsonld-incomplete` (warning: a BreadcrumbList item without a position, name or, but the last,
  an item URL; a VideoObject without name, thumbnailUrl or uploadDate; a FAQPage question without its answer text); and,
  from `/robots.txt`, `robots-missing`, `robots-blocks-all`, `robots-no-sitemap` and `sitemap-blocked` (error: the sitemap
  lists a URL robots.txt disallows to Googlebot, matched as RFC 9309 says). `crawlSite` returns `robots` (the file's text, null
  when it did not load as text) and `auditPages` takes it; left out, the robots checks are skipped. The four live sites
  checked (dustinedwards.info, Foxing, julieedwards.info, the specimen) have no new findings.
- More audit checks, from Bing's and Google's guidance: `sitemap-lastmod-missing` and `sitemap-lastmod-uniform` (Bing calls an
  accurate lastmod a top recrawl signal; one shared date reads as the build date; `crawlSite` returns `lastmods`, which
  `auditPages` takes); and for images `image-size-missing` (no width and height, so the layout jumps:
  https://web.dev/articles/optimize-cls), `image-filename-generic` (`IMG_0042.jpg`), `image-alt-generic` (alt "image" or
  "photo") and `image-lazy-missing` (four or more images, none lazy). `link-redirect` is now an **error**: an internal link
  points at the final URL, so a link that redirects is a link to fix. The live sites checked have no such link except
  Capsomer's, fixed in its site.
- `sitemapDocument` throws past 50,000 URLs or 50 MiB, the limit a crawler reads one file to
  (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), and says to split; new
  `sitemapIndexDocument(sitemaps)` writes the index that lists the files, and `SITEMAP_MAX_URLS` and `SITEMAP_MAX_BYTES` are exported.

## 0.35.1 (2026-11-07)

- The `enarratio` peer range is `^0.7.3 || ^0.8.0 || ^0.9.0` (it was exactly 0.7.3), so a site that moves Enarratio no
  longer fails with ERESOLVE. The dev dependency is 0.8.0. No code change.

## 0.35.0 (2026-11-07)

- **Removed:** `render/chart-enhance` and its `enhanceCharts`. A chart's redraw spec is now written in Enarratio's own
  attribute, `data-enarratio-redraw` (it was `data-prelum-chart`), so Enarratio's `redrawCharts` from `enarratio/redraw`
  (the same call Capsomer's chart-enhance makes) is the one script and Prelum no longer carries a copy. Replace
  `import { enhanceCharts } from "@drdustinedwards/site-helpers/render/chart-enhance"` with
  `import { redrawCharts } from "enarratio/redraw"`. `RENDER_VERSION` is 19, so stored HTML re-renders on a mismatch;
  until it does, a chart still carrying the old attribute is the server's drawing, readable with its table.
- **Renamed:** `runConformance` (`render/conformance`) is `runRenderConformance`, because site-api exports a different
  `runConformance` for the Carrel API and devkit's overlap check flags the shared name.

## 0.34.0 (2026-11-07)

- New in the library, so the sites stop carrying their own copies: `htmlToText(html)` (`./text`: scripts, styles, tags and
  Prelum's `#` heading anchors dropped, entities decoded, white space collapsed; `metaText` is now this plus the cut),
  `isoDuration(seconds)` (`./text`), `shareCard(url, alt)` and `SHARE_CARD_SIZE` (`./head`, the 1200 by 630 card), and
  `itemList` items take an optional `description`. No behavior change to anything that existed.
- `frontmatter` is this module's alone: site-api drops its re-export of the mechanics (`splitSource`, `joinSource`,
  `readKey`, `readList`, `setBlock`, `setRawKey`) in 0.27.0 and keeps only the Carrel field names built on them. The six
  exports and their signatures are unchanged.
- The specimen's Worker (site-runtime 0.87.0) answers the shared 503 maintenance page while its `MAINTENANCE` var is on, and its `/404` answers 404, not 200. Not in the library.
- CI: one check job per pull request (devkit v0.26.1 pr.yml in `checks.yml`, reported as `checks / Repo checks`) runs the
  trailer, shared-code, OSV-Scanner, workflow audit and reviewer checks; `review.yml` and `workflow-audit.yml` are gone.
  The dependency scan runs daily only, and the code map and Scorecard nightly instead of on every push. ci.yml still runs
  on a push to main, for the specimen deploy.
- Formatting is the network's shared Oxfmt config (`oxfmt.config.ts` spreads devkit's `./oxfmt`; `npm run format`, and
  `npm run format:check` in CI). The whole tree was reformatted in one formatting-only commit, listed in
  `.git-blame-ignore-revs`; the golden render fixtures, the specimen's inputs and its expected output are ignored, so they
  stay byte for byte. No behavior change. devkit is v0.24.0.
- Lint is the network's shared Oxlint config (`oxlint.config.ts` extends devkit's `base`, `node` for the modules, bin, tests
  and specimen), type-aware through `oxlint-tsgolint`, run as `npm run lint`. What its first run found is fixed in place,
  behavior unchanged: a dropped `body.cancel()` promise is `void`ed; two click handlers that were `async` are a named
  async function called through `void`; `[...string]` counts are `Array.from`; and the declarations and their modules' JSDoc no longer say
  `any` (`unknown`, hast types, a `Wasm` type for `createHighlight`'s `wasm`, shiki's `LanguageInput` for its
  `languages`; `rehypeModelMarker` takes its model as a type parameter). Types only. `FetchHandler` and
  `serveMarkdownCopies` keep `any` as their handler bound, with the reason beside it: it is the one bound that admits a
  handler typed with its own `Env` and `ExecutionContext` and keeps an inline handler's parameters usable.
- The type check now checks the modules themselves. `tsconfig.json` listed both `*.mjs` and `*.d.mts`, and when a module
  and its twin both match, tsc keeps only the declaration, so no implementation was checked. It now lists the modules
  (lib es2023 with DOM iteration), and the 29 errors that surfaced are fixed: missing parameter types, and two places in
  `render-nomath.mjs` (the library credit's mark is a WeakSet instead of an untyped `data` field; a video's poster is
  read once). No behavior change.

## 0.33.0 (2026-11-05)

- Titles and descriptions are measured as Google draws them, in pixels, not characters. Google cuts a result's title and
  snippet to fit the device width (https://developers.google.com/search/docs/appearance/title-link), and "about 60
  characters" warned on titles of 61 to 62 narrow characters that fit, while passing 50 wide ones that do not. New
  `serpWidth(text, font)` (Arial's advance widths) and the measures `SERP_TITLE` (600 px at 20 px) and `SERP_DESCRIPTION`
  (920 px at 14 px); `prelum-audit`'s `title-long` and `description-long` warn past them and say the width, and
  `searchTitle`, `defineHead`, `metaText` and `truncateForSerp` cut to them (`truncateForSerp` still takes a number of
  characters for X's image alt). **Removed:** `SERP_TITLE_LIMIT` and `SERP_DESCRIPTION_LIMIT`; use `SERP_TITLE` and
  `SERP_DESCRIPTION`.
- No false passes or failures (devkit-live's contract, devkit 0.21.3): what a check could not measure is
  `::notice title=<item>::<url> could not measure: <reason>`, and the exit is 3 when nothing failed. `prelum-audit`'s
  `fetch-failed` (a page that got no answer) is not measured, never an error, and no longer adds a false `sitemap-broken`
  "answers 0"; `prelum-content` names each sitemap page it could not read instead of leaving it out silently; a page
  `prelum-chart-audit`'s browser could not open (a timeout, a refused load) is not measured, never a warning that passes.

## 0.32.9 (2026-11-05)

- `prelum-chart-audit`'s check F no longer counts a diagram's ports, a dot on the end of one of its wires, as a chart's
  marks. Capsomer's system map draws one on each end of every tie, and dustinedwards.info's 20 /systems pages failed F as
  "an SVG chart drawn outside Enarratio".
- The specimen is on Capsomer 0.73.0, the network's type: Inter for the interface (preloaded), Overpass for the footer
  links and Medium headings. The library is unchanged.
- The specimen is on Capsomer 0.74.4 (titles Light, headings Medium, breadcrumb links Bold), and its contents label
  is Medium like the other headings, where it was 600. The library is unchanged.
- The specimen is on Capsomer 0.75.0, its lighter Inter (the text cut, 46 KB) and Overpass (plain English characters,
  15 KB) files; it preloads Inter by its new name. The library is unchanged.
- `allowScripts` approves Puppeteer's install script (it downloads the Chromium `drawDiagrams` launches), for npm 12,
  which runs none by default.
- Breaking: `drawDiagrams` no longer takes `colours`, the old name of `colors`; pass `colors`. <!-- codespell:ignore -->
- Breaking: `prelum-chart-audit` no longer takes `--strict-frame`, which has changed nothing since the frame became an
  error by default; drop the flag (the audit now stops on it as an unknown option). `--no-strict-frame` stays.

## 0.32.8 (2026-11-04)

- A `:::chart` caption written in the post goes where Enarratio puts its own: after the drawing, its control row and the
  summary. Prelum put it between the drawing and the control row, and `enhance()` puts the row back right after the drawing
  each time the redraw swaps it, so on a phone the row jumped above the caption as the page loaded (D5, 0.016 to 0.035 on
  dustinedwards.info's posts with charts). Part of `RENDER_VERSION` 18.
- Removes dead code: the unused `CALLOUTS` list, the module-only exports `faqPairs` and `STRICT_CHART_ISSUES` (neither module is a package export), and the specimen's fallback to the token file name Capsomer used before 0.21. No package changes.
- The specimen and tests use Capsomer 0.66.0 (the devDependency, from 0.65.0). Its fallback fonts have a bold face per weight range, so bold text in a fallback is as wide as the real face and headings no longer rewrap when the font arrives. No package changes.
- Draws the specimen and tests with Enarratio 0.7.3 (the devDependency, from 0.7.0; the peer range is unchanged). With 0.7.3
  a chart no longer moves the page when the enhancement layer loads. Its figure writes the controls `enhance()` adds (Show
  table, Play as sound, Pick a range, the downloads) into the markup, inert and marked `data-enarratio-pending`, and
  `render/chart-enhance` swaps in the working ones. So the default `assertSafe` allowlist adds `button` (`class`, `type`)
  and `div` and `span` with `inert` and `data-enarratio-pending`. Without that, a site on Enarratio 0.7.3 with `assertSafe`
  on would have every chart refused. `RENDER_VERSION` is 18, since a chart now writes those controls.
- A site on Enarratio 0.7.3 that renders `:::chart` but never calls `enhanceCharts()` shows those controls inert while
  scripts run (`@media (scripting: none)` hides them). The specimen calls it on every page.

## 0.32.7 (2026-11-03)

- `prelum-chart-audit` reports D5, a chart that does not reserve its size: at 1280 and 320 px, layout shifts with no recent
  input that move a chart's contents by 0.01 or more in all. A shift counts only while what it moves is on screen, and charts
  grow as the page loads (hydration, then the enhancement layer), mostly below the fold, so the first chart is held at the top
  of the screen as the page loads, each chart is then scrolled to and given a moment, and a chart that changed size out of
  sight is held in view in a load of its own (up to three more loads, only on a page with such a chart). Foxing's
  /demos/stats, Foxhound's dashboard and Prelum's specimen (Enarratio before 0.7.3) were passed with no D5.

## 0.32.6 (2026-11-03)

- `prelum-chart-audit` counts a password form as a sign-in wall only on a page the reader was sent on to. A public page that
  shows a password field in place, such as Capsomer's field demo, was failed with a false G error.
- `prelum-chart-audit` opens a closed fold (a `details` element) that holds a chart before reading it, as a reader would. A
  chart frame folded away (the Portal's trends) redraws at its width only once opened, so it was read at its first width and
  failed C12, with its finding sentence called hidden.

## 0.32.5 (2026-11-03)

- `prelum-chart-audit --pages` keeps a named page's query, so `/x?tab=a` and `/x?tab=b` are each read (a chart behind a
  tab). Pages the crawl finds by link are still keyed by their path alone.

## 0.32.4 (2026-11-03)

- `prelum-chart-audit` fails a run whose every page lands on a sign-in wall with the G error (exit 1). It exited 2,
  "could not run", without printing the error, so a site with only signed-in chart pages (Desk) was never failed.

## 0.32.3 (2026-11-03)

- `prelum-chart-audit` fails a page that lands on a sign-in wall (Cloudflare Access, a sign-in or log-in path, or a
  password form) with a G error. Such a page read as "0 charts, no findings" and passed, though none of its charts was read.

## 0.32.2 (2026-11-03)

- `strictCharts` no longer refuses a chart for its text's reading grade: only a missing title or too many series. Text
  should be whatever reads best, and a grade formula cannot judge that (Enarratio 0.7.1 drops the check too).

## 0.32.1 (2026-11-01)

- Accepts Enarratio 0.7.0 as its peer (`^0.5.0 || ^0.6.0 || ^0.7.0`), and draws the specimen and tests with it. 0.7.0's
  legend carries `data-enarratio-legend`, so the default `assertSafe` allowlist adds `ul data-enarratio-legend`;
  `RENDER_VERSION` is 17, since a chart's legend now writes that attribute.
- `prelum-chart-audit`: a shape inside an `aria-hidden` group and painted in the color behind it is the ground, as one
  that is itself `aria-hidden` already was (B1). This is the gap a choropleth draws between regions, which B6 lets a
  separator be; Enarratio 0.7.0's region edges were read as marks at 1.00 to 1.03:1.
- `prelum-chart-audit` D6 weighs the drawing a reader is shown, its inline SVG, as checklist D6 says, not the whole
  frame: the data table (the chart's text equivalent) and the narrow drawing a redraw spec holds for a phone no longer
  count. A 321-address dot map was 256 kB of frame for an 88 kB drawing.

## 0.32.0 (2026-11-01)

- `render/enhance` exports `enhanceEmbeds({ root })`, the click-to-play embeds alone, for a site with its own post chrome (germomics has its own lightbox). `enhance()` calls it, so a site that calls `enhance()` changes nothing.
- Breaking: Amazon Music embeds come from amazon.com only (`music.amazon.com/embed/`). The other eleven country sites are not on site-runtime's frame list (0.70.0), so a player from one could never load; a post that pasted one is refused at render.
- CI: devkit v0.21.0 in every workflow call and in `package.json`.
- Specimen: Capsomer v0.62.0, so its 404 page no longer scrolls sideways at 320 px (a written-out address now wraps).
- Specimen: the sample relative link and next link point at `/accessibility` instead of `/writing/other` and `/writing/next`,
  which do not exist on the specimen, so the home page links no missing page. No library change.
- CI: OpenSSF Scorecard (devkit 0.20.24 scorecard.yml, weekly and on push to main), and each release's `npm pack` tarball is attested and attached to the release (devkit release.yml; the caller grants `id-token` and `attestations`).

## 0.31.4 (2026-11-01)

- Specimen: Capsomer v0.60.0 with its link system (`link.css`): links are semibold in the link color with no underline,
  and each kind carries its mark (away, file, jump, mail, phone, language, address, next). The heading anchors and the
  element titles lose their own underlines. The specimen serves its accessibility statement at `/accessibility`
  (`accessibilityStatement`, `capsomer: true`, `links: "marked"`), linked from the footer (`statement`) and listed in
  the sitemap. No library change.
- Specimen: the audio player fits a 320 px column, and displayed math keeps half an em above and below so WCAG 1.4.12's
  text spacing no longer clips it. The live check's two findings, so the statement lists none of its own.

## 0.31.3 (2026-11-01)

- `markdownCopies` takes any Worker fetch handler: `FetchHandler`'s `ctx` is `any`, since the wrapper passes the Worker's
  ExecutionContext through untouched. A handler typed `(request, env: Env, ctx: ExecutionContext)` (one that reads
  `ctx.exports`, as bsw's gateway does) failed to typecheck against the narrower `{ waitUntil }`. Types only.
- CI: a release starts Renovate in every repository that pins Prelum (devkit 0.20.23 bump-consumers.yml, from
  release.yml and on a tag push). Needs the `RENOVATE_TRIGGER_TOKEN` repository secret.
- `.shared.json` names the two local helpers the shared-code check took for copies: `esc` in `./accessibility` (the helpers
  take no dependency on site-runtime) and `hex` in `prelum-chart-audit` (it runs inside the audited page).
- The 0.31.2 tag was cut from #196 before these merged, so they ship here.

## 0.31.2 (2026-11-01)

- An animated image's still (the picture shown under reduced motion) now carries the image's `sizes`; it had a `w` srcset with no
  `sizes`, so a browser took the widest file for any slot. `RENDER_VERSION` is 16.
- The specimen's poster is served in two widths (320 and 640) with `sizes`, so a phone downloads the small one.

## 0.31.1 (2026-11-01)

- The optional `enarratio` peer accepts 0.6 as well as 0.5 (`^0.5.0 || ^0.6.0`), so a site on Enarratio 0.6.0 installs
  Prelum without an override. Prelum is tested against 0.6.0.
- Specimen: its scripts inline Enarratio 0.6's lazily loaded sound module, so each stays one file under the page's
  script hashes.

## 0.31.0 (2026-11-01)

- `defineHead` writes a BreadcrumbList only for a trail of three or more (home, a section, the page;
  `BREADCRUMB_MIN_ITEMS`). A top-level page shows no trail on any site, and markup must describe what a visitor sees, so its
  two-item list is gone; its WebPage stays. Breadcrumbs belong to pages inside a section (Nielsen Norman, GOV.UK), and
  Google asks for no markup of content a visitor cannot see.
- `./markdown-copy`: `markdownCopies(fetch, { origin, llmsFull, skip })` wraps a Worker's fetch handler so every page has a
  Markdown copy at `/path.md` and for `Accept: text/markdown`, made from the page's `<main>` by `htmlToMarkdown(html, { base })`,
  and builds `/llms-full.txt` from llms.txt and the sitemap where the site serves none (area 1, gap 5). A site's own copies and
  llms-full.txt are kept. Every HTML page gains `Vary: Accept` and a `Link: rel="alternate"; type="text/markdown"` header. New
  optional peers: `hast-util-to-mdast`, `mdast-util-to-markdown`, `mdast-util-gfm`. No change to `render` or RENDER_VERSION.
- A static site writes its copies at build time instead, so its Worker carries no HTML parser: `writeMarkdownCopies({ dir,
  origin })` in `./markdown-files` (Node) and the `prelum-markdown` bin write each page's `.md` and llms-full.txt beside the
  built pages, and `serveMarkdownCopies(fetch, { origin })` in `./llms` serves them for `/path.md` and `Accept: text/markdown`.
- Specimen (area 1, gap 3): its head comes from `defineHead`, so the page carries its WebPage beside a WebSite and
  SoftwareSourceCode graph; it serves robots.txt (the network's bot policy, Content-Signal and the Sitemap line), ai.txt and
  llms.txt; `npm run specimen` writes its Markdown copy and llms-full.txt with `prelum-markdown` and its Worker serves them
  with `serveMarkdownCopies`; and
  its sitemap gives the page a lastmod, the date of the release it shows. No library change.
- CI: the footer strip, the trailer check and the shared-code check run in one job (devkit 0.20.23 checks.yml), in place of three workflows.

## 0.30.1 (2026-11-01)

- `accessibilityStatement`: the Capsomer sentence calls it "an open-source design system", not "the design system the
  sites of this network share", because a site outside the dustinedwards.info network (julieedwards.info) is built from
  it too. No other change.

## 0.30.0 (2026-11-01)

- **Breaking:** `accessibilityStatement` requires two facts about the site, `capsomer` (are its pages built from Capsomer)
  and `links` (how its links in running text stand apart: `"marked"`, Capsomer's link system; `"underline"`; or
  `"bold"`, a heavier weight), and throws without them. The statement said every site was built from Capsomer and that
  its links were heavier weight and marked, which was false on julieedwards.info (underlined, normal weight) and bsw
  (no Capsomer). Now the Capsomer sentence appears only with `capsomer: true`, and the links sentence says what the
  site draws. Each value passes WCAG 2.2 SC 1.4.1 (F73 names an underline or bold as a non-color cue). `"marked"` needs
  `capsomer: true`. No change to `render` or RENDER_VERSION.

## 0.29.1 (2026-11-01)

- `prelum-chart-audit` (B1): a shape that is `aria-hidden="true"` and painted in the color behind it is the ground, not a mark,
  so a donut's hole (Enarratio paints it in the background) no longer reads as a mark at 1:1. An HTML legend swatch is read by
  its edge as well as its fill, as an SVG mark is by its outline, so a pale ramp step's swatch with Enarratio's 3:1 edge passes.
  Both were false findings on every heatmap and donut on the gallery. The 320 px pass scrolls through the page a screen
  at a time before it measures, as a reader does, so a chart a site draws again or swaps for its narrow drawing as it nears
  the viewport (the gallery's, which enhances lazily) is measured as the reader sees it. A table chart may scroll sideways
  in its frame at 320 px, as WCAG 1.4.10 allows a data table. No change to `render` or
  RENDER_VERSION.

## 0.29.0 (2026-11-01)

- `accessibilityStatement` also returns `html`, the same sections as escaped HTML, so a site with no Markdown pipeline (bsw,
  julieedwards.info) serves `/accessibility` without installing the renderer's peers. `body` is unchanged.
- Specimen: site-runtime 0.68.1, which splits the long `Permissions-Policy` line of `_headers` into several lines.
  Cloudflare caps each `_headers` line at 2,000 characters and joins a repeated header with commas, so the header is
  the same and the specimen deploys again (0.28.1's deploy failed on line 5). No library change.

## 0.28.1 (2026-10-31)

- A link's icon (`img.cap-link-icon`) is `loading="lazy"` and `decoding="async"`: most sit below the fold, and a 16 px
  icon should never compete with the page's pictures. `RENDER_VERSION` is 15.
- Specimen: site-runtime 0.67.0, so its pictures, link icons and share card answer CORP `cross-origin` (C11) and its
  clip and tone play (`media-src 'self'`). No library change.
- Specimen: no `fetchpriority=high` at all. The page opens with words, and its first picture (y≈4,700 at 1440) was
  marked high below the fold (A6). No library change.

## 0.28.0 (2026-10-31)

- `./accessibility`: `accessibilityStatement({ siteName, contact, date, conformance, limitations, measures })` returns the
  statement every public site serves at `/accessibility` (devkit-a11y S6) as Markdown, in the W3C WAI generator's sections: the
  commitment, the standard (WCAG 2.2 AA) and conformance status, measures, known limitations, how to report a problem, and the
  date. A site passes its name, contact route and review date, and the open findings from its latest devkit-a11y report; the
  hand-check gaps are added until `conformance` is "full". Also `ACCESSIBILITY_PATH`, `ACCESSIBILITY_STANDARD`,
  `HAND_CHECK_LIMITATIONS`. No change to `render` or RENDER_VERSION.

### Changed

- `EMBED_FRAME_SOURCES` is removed from `./render/embeds`: the players' origins live in site-runtime (`@dustinedwards/site-runtime/embeds`,
  0.66.0), whose `embeds` opt-in also hands them autoplay, encrypted-media, fullscreen and picture-in-picture and keeps COEP
  Report-Only, without which every player was blocked. The test holds every player here to that list. The specimen's headers
  take it from its registry entry. `RENDER_VERSION` is unchanged.

## 0.28.0

Embeds limited to the services Dustin uses, with Vimeo removed (see the first items under Changed). Images and media (area 6, round 2): diagrams sized, one high image per page, animations that move and can be paused, the library's
credit on the page and in its ImageObjects, a refused missing alt, the served type on the share card, and video posters, lite
embeds, `og:video` and VideoObject.

### Changed

- `RENDER_VERSION` is 14. `::embed` takes YouTube, TikTok, Spotify, SoundCloud, Apple Podcasts, Amazon Music (the src of its
  Share > Embed code), Google Maps (the src of its Share > Embed a map code, no API key), X, Bluesky (a post URL with the
  account's DID; a handle URL is refused with how to get it) and Instagram. **Vimeo is removed**: a body with a Vimeo embed now
  stops with the line to fix. Every embed still loads nothing from the service until a click.
- A map or a post has no play button (`span.embed-play` is for video and audio), and only a video embed goes into `videos`, so a
  song, map or post is never `og:video` or a VideoObject (before, a Spotify embed was).
- New `./render/embeds`: `EMBED_PROVIDERS` (each with its `kind`, player `origin` and `path`), `EMBED_FRAME_SOURCES` for a site's
  CSP `frame-src` (site-runtime's `frame` sources; without it the players are blocked) and `embedPlayerUrl`, the check
  `render/enhance` runs on a click. `render-blocks` still exports `EMBED_PROVIDERS`.
- A site re-renders its stored bodies; one that holds `![](x)` now stops with the line to fix.
- A diagram `<img>` carries its drawing's `width` and `height`, `loading="lazy"`, `decoding="async"` and `role="img"`.
  `drawDiagrams` writes each drawing's size to `sizes.json` (`DIAGRAM_SIZES_FILE`) beside the drawings and returns it as
  `sizes`; the site passes it to `editorialPack({ diagramSizes })`. A diagram it does not list is written unsized, with a warning.
- `options.priority`: one `{ taken: false }` passed to every render of a page gives the page one `fetchpriority=high`, its first
  image; `false` or `{ taken: true }` gives a body none. Without it each render's first image takes it, as before.
- A `<picture>` keeps each source's `media`, so a GIF from site-runtime's ./image moves for readers who allow motion and shows its
  still under reduced motion (before, the still won for everyone). Such an animation also gets a **Pause animation** checkbox,
  for everyone, without script (WCAG 2.2.2): `span.motion` holds the animation, its still (`picture.motion-still`, hidden by an
  inline style) and `label.motion-pause`; the site's stylesheet shows the still while it is checked (the specimen's `site.css`
  has the rules Capsomer's prose blocks need).
- The resolver may return `credit` and `license`. They show under the picture as `span.figure-credit` (an author's `credit=`
  wins; a paragraph holding only the picture becomes `figure.image-figure`), and render returns `images`: each picture's `src`,
  `alt`, size, `creditText`, `copyrightNotice` (a license in words) and `license` (a license URL), ready for `imageObject` and the
  image sitemap. Decorative pictures, dark twins and embed posters are left out.
- An image with no alt text (`![](x)`, `![ ][ref]`) is refused, not warned about. `![""](x)` marks a decorative one.
- `:::video` requires a `poster` and takes its size, so the player has `width` and `height`; a poster the site has no size for
  is a warning. `::audio` preloads nothing (`preload="none"`).
- `::embed` is a lite embed: an optional `poster` (the site's own picture, never the service's thumbnail) under a play button
  (`span.embed-play`) with the title (`span.embed-label`), inside the same link. render returns `videos` (each file and embed with
  its title, poster, captions, player URL and size).
- `headTags`: `og:image:type` is the `type` passed, else the extension's only for a URL with no query (a resized size is served
  as WebP or AVIF whatever its name says), else none. `videos` writes `og:video`, `og:video:secure_url`, `og:video:type`,
  `og:video:width` and `og:video:height` for each.
- The allowlist gains `img role`, `label class`, `picture class`, `picture style`, `source media`, `video height` and
  `video width`.
- A fetched link icon is kept at 32 px (its display is 16): a larger PNG is shrunk, and a favicon.ico keeps only the smallest
  size that covers it (`fitLinkIcon`, `LINK_ICON_SIZE`). An icon already stored stays as it is until its entry is deleted.

### Added

- `schema`: `articleImageSet(crops, rights)` orders an Article's 16:9, 4:3 and 1:1 crops as Google asks, gives each the
  picture's rights and refuses a crop that is not its ratio (`ARTICLE_IMAGE_RATIOS`); `videoObject(video)` writes a VideoObject
  and refuses one without `name`, `thumbnailUrl`, `uploadDate` and a `contentUrl` or `embedUrl`.

### Specimen

- One `fetchpriority=high` on the page (it had three), the diagram sized from its drawing, and MDN's 48 px link icon kept at 32.
- New elements: an image with a library credit, an animated image with its pause control, a decorative image, video, embed,
  audio, gallery, inline marks, button and bookmark, and questions and answers, so every directive a site gets is shown and
  Carrel's Insert menu lists them. The home page writes the ImageObject and VideoObject, `og:video`, and its images in the
  sitemap. The clip and the tone play once site-runtime's `prelum` entry allows `media-src 'self'` (its page policy has
  `default-src 'none'`).

- CLAUDE.md: releases are tagged through Capsid after the version bump merges (Capsid's daily pass tags any it missed), not by Dustin by hand. No library change. Also dropped the RENDER_VERSION rule: test/render-golden.test.mjs already fails when a hash changes without a bump.
- Specimen: deployed by devkit's shared deploy (worker-deploy.yml v0.20.18), a `deploy` job in ci.yml after the checks, in place of
  specimen.yml. It deploys with `DEPLOY_SHA`, waits for `/health` (site-runtime 0.60.0's `staticSite`) to report the commit,
  checks the home page and rolls back on a refusal; IndexNow runs after it. No library change.

### Changed

- `linkIconResponse` takes the site's header set for a file it did not write, `{ headers: UPLOAD_HEADERS }` (site-runtime),
  and requires it: security headers are site-runtime's, so Prelum no longer writes its own nosniff and sandbox policy.

### Specimen

- Headers come from the specimen's entry in site-runtime's registry: the Worker is `staticSite({ site: prelum })` and `_headers` is
  written by `site-runtime-headers` (with the TDMRep header), so `specimen/headers.mjs` is gone. The page adds COEP with
  report-to, Integrity-Policy and Trusted Types in Report-Only, and both script tags carry a sha384 `integrity` and
  `crossorigin`.

## 0.27.1 (2026-10-31)

- `render-version.d.mts` declares `RENDER_VERSION: "12"`, as `render-version.mjs` exports; it still said "10", so a site that types its stored
  version against Prelum's (`satisfies typeof RENDER_VERSION`) could not set the real one. The golden test now fails when the two differ.

## 0.27.0 (2026-10-31)

Prelum's chart redraw now lives in Enarratio, shared with Capsomer (charts, area 10).

### Changed

- Enarratio 0.5.0. `render/chart-enhance` redraws through Enarratio's `enarratio/redraw` (the same code moved into Enarratio, which
  Capsomer's chart-enhance shares); its behavior and `enhanceCharts` are unchanged, and the spec stays in `data-prelum-chart`.
- `RENDER_VERSION` is 12: Enarratio 0.5 draws `:::chart` differently (the x title sits 1.5em under its ticks, scatter axes are
  padded, y axes end on a tick, x ticks fit the width, tick labels use proportional figures, and Download SVG and PNG join
  Download CSV). The allowlist drops `g font-variant`.

### Specimen

- Enarratio 0.5's Download SVG and PNG buttons take the chart link style.
- The specimen's Capsomer (v0.55.0) still names Enarratio ^0.4.0 as an optional peer; `overrides` in package.json gives it 0.5.0
  until a Capsomer release names ^0.5.0, then the override goes.

## 0.26.0 (2026-10-31)

The Prelum side of the family's link contract (Dustin, 2026-10-31): every link a body renders says what kind it is, for Capsomer to
style from the markup.

### Changed

- `RENDER_VERSION` is 11: links carry the contract above, and the allowlist gains `a data-link`, `a data-site`, `a hreflang`,
  `a rel` and `span lang`.
- A box that scrolls sideways is a named region a keyboard can focus: `div.table-scroll` gains `role="region"` and
  `aria-label="Table: <first four headers>"` (or `Table`), and every `pre`, highlighted or not, gains `tabindex="0"`,
  `role="region"` and `aria-label` from its frame title (`Code: app.ts`), else its language (`Code: TypeScript`), else `Code`. The
  allowlist gains `pre role` and `pre aria-label`.
- The URL policy allows `tel:`, for phone links. A dialer runs nothing.

### Specimen

- The Links element shows every kind, with Capsomer's family list and MDN's icon, fetched once and committed in
  `specimen/link-icons/` (an empty file is a host with none, so builds and tests reach no other site).

## 0.25.0 (2026-10-31)

Charts that fit a phone, and a chart check that sees what it missed (charts, area 10).

### Added

- `render/chart-enhance` (browser): `enhanceCharts(root?, options?)` adds Enarratio's enhancement layer (`enarratio/enhance`:
  keyboard walk, focus announcements, tooltips, legend filters, a sortable table) to every `:::chart`, and redraws each to its
  frame's width when that is narrower than the 700 px drawing, so a post's chart fits a 320 px phone instead of scrolling
  sideways. Bar, line and area are drawn again by `enarratio/lite` (a line chart under 400 px without its end labels, which
  keep 96 px whatever the width, so its lines fill the frame; the legend names the series); a dot chart swaps in a 240 px
  drawing the server wrote. A
  site adds one import to the script it bundles (README, "Charts in posts"); it is same-origin with no inline script, so a hash
  CSP holds. Without it the chart reads as before.
- `:::chart{src="..."}` (E3): the CSV may be cited by URL or media path, read at render time by the site's
  `editorialPack({ chartData })` loader. Prelum fetches nothing itself; a `src` without the loader is refused.
- `editorialPack({ strictCharts: true })` (E4) refuses a chart with no title, author text above reading grade 9 or too many
  series (`STRICT_CHART_ISSUES`), so Carrel can block a publish on them. The default still renders them with a warning.
  `buildChartModel(attrs, csv, { strict })` takes the same option.
- `prelum-chart-audit`: a 320 px pass that fails C12 when a drawing overflows its frame sideways or chart text is under 12 px;
  `--pages <file | comma list>` for pages no link reaches; repeated `--start <url>`, opened first in every browser context so a
  demo route's session cookie opens the pages behind it.

### Changed

- `RENDER_VERSION` is 10. A `:::chart` frame carries `data-prelum-chart`, what `render/chart-enhance` redraws it from, and the
  render allowlist admits it. Charts are drawn by Enarratio 0.4.1 (devDependency 0.4.0 before).
- `prelum-chart-audit` is strict by default: a missing CSV link (C1), source line (C2) or frame (F) is an error.
  `--no-strict-frame` makes them warnings; `--strict-frame` is still accepted.
- `prelum-chart-audit` B28 accepts `role="group"` with `aria-roledescription="chart"` for an enhanced chart (WAI-ARIA APG),
  as well as `role="img"`.
- `prelum-chart-audit` accepts an inline primitive (Enarratio's `inline: true` sparkline, heat strip, progress ring, uptime
  strip or timeline, in no figure) without a frame, title, caption, CSV or table when it is `role="img"` with a name that
  states its values or finding, or `aria-hidden` beside visible text that gives the numbers; otherwise B18 (README).
- Sample content no longer comes from one site. The test fixtures that hold the package to the sites' output keep their captured
  byte layout but carry example.com content, under names that say what each one tests (`sitemap-compact.xml`, `llms-prose.txt`,
  `feed-cdata.rss` and the rest); the two unused captures, with a real biography in one, are gone. The specimen's lists, table,
  code, details, pull quote and bar chart use neutral examples in place of lab samples and sequencing reads. Doc examples in `head`,
  `render-diagram`, `render-packs`, `xml` and the README name Example Co and an `example-` prefix. The render fixtures' media names use the
  `example-` prefix too, so their golden hashes moved with the input.

### Fixed

- `prelum-chart-audit` reads a `url(#id)` fill as its pattern's base `<rect>` or its gradient's first stop before measuring
  contrast. Enarratio's textured series (the dei CV's "Output by year") read as 1.00:1 false positives.

### Specimen

- The specimen's Worker is site-runtime v0.52.0's `staticSite` in place of its own code: the same https redirect, report endpoint,
  preload Link and charset, plus the site's own prefetch rules at `/speculation-rules.json` with the `Speculation-Rules`
  header on every page (in place of Cloudflare's generic ones) and `Server-Timing`. A page asked for with a cookie is
  `private, no-store`, as the 404 page already was. The fonts, KaTeX, images and diagrams no longer run the Worker
  (`run_worker_first`). The page looks the same: home page screenshots before and after are identical.
- The specimen's home page writes its head with `headTags`, so it has a share card: `share-card.png` (1200x630) with
  `og:image:type`, `width`, `height` and `alt`, and the canonical, Open Graph and X tags that come with it.
- `/specimen.js` calls `enhanceCharts()`, so the four charts redraw to a 320 px screen and take Enarratio's enhancement.
- The specimen's prose paragraph and list rules leave a chart's own parts alone, so the summary no longer sits flush under the
  chart's buttons and the legend is no longer indented. A chart's source and "Download CSV" links are semibold in the link
  color with no underline, and its tick labels take proportional figures ("1,600", not "1 , 600", which the interface face's
  tabular comma made).

## 0.24.0 (2026-10-31)

One frontmatter reader and writer for every site and package (writing and rendering, area 4).

### Added

- `splitSource`, `joinSource`, `readKey`, `readList`, `setBlock` and `setRawKey` in `frontmatter`: site-api 0.17.0's block reader and
  writer, moved here. A write replaces only the block it names, and every other block, comment and unknown key comes back byte for
  byte. site-api re-exports them, and Capsomer's and Carrel's own header readers are replaced by them.

### Changed

- `frontmatter(source)` is built on the same reader. Values in double quotes are read as JSON strings (`"a\"b"` is `a"b`), single
  quotes take `''` as one quote, the fences may carry trailing spaces, and `body` starts after the blank lines that follow the
  closing fence.
- CI: devkit 0.20.8. The family check is now the shared-code check (`shared.yml`, `.shared.json`, `devkit-shared`). A newer push to a
  pull request cancels its older runs, and the workflow audit and dependency scan run only when their files change.
- Specimen: site-runtime 0.50.0. Its `headersFile` writes cross-origin CORP on css, js, mjs, svg and woff2, so the specimen's own
  rule for it is gone (security headers, area 2).
- Specimen: KaTeX's faces use `font-display: swap` in place of its `block`, so math shows at once in the fallback face (speed,
  area 7).

### Fixed

- `prelum-icons` draws a mark that holds a raster image (a PNG logo inside the SVG) on the Apple touch and maskable icons.
  Those two came out as plain background, because resvg loads no image inside a nested SVG; the mark now goes onto the
  background already drawn as a PNG, and an image it links by relative path is read from the mark's folder.

## 0.23.0 (2026-10-31)

Post charts in Capsomer's chart frame (charts, area 10).

### Changed

- `RENDER_VERSION` is 9. `:::chart` output sits in Capsomer 0.53's chart frame: Enarratio's figure (still `figure.chart-figure.enarratio`,
  with the author's caption in it) is wrapped in `div.cap-chart > div.cap-chart-figure`, the markup Capsomer's `frameHtml(figure)` writes,
  so `prelum-chart-audit`'s frame check (F) passes for it. Prelum writes the markup itself and does not depend on Capsomer. A site styles
  the frame with Capsomer's `components/chart-frame/chart-frame.css`, which the specimen now loads.

### Specimen

- Every specimen page now sends a preload Link header for its stylesheet, Schibsted Grotesk and Source Serif 4, so the zone
  answers with Early Hints (site-runtime `withPreloadHeader`, the same three files as Carrel's public site). The build
  refuses to finish when it did not write one of them. The 404 page is sent `private, no-store`. The published library
  does not change.
- The specimen serves the shared icon set (`prelum-icons` from its P mark on #4f2d7f, `iconLinks()` and `webManifest()`),
  with `manifest-src 'self'` in its page policy; `favicon.svg` is gone.
- The specimen's 404 page names its charset (`text/html; charset=utf-8`, site-runtime `applyHeaderSet`): it answers any
  path, so no `_headers` rule could.

## 0.22.1 (2026-10-31)

### Fixed

- `prelum-content` runs from a plain install again. `RENDER_VERSION` moved to its own module (`render-version.mjs`), so the
  check no longer loads the renderer and its optional peers; installed alone, as the devkit scoreboard installs it, it
  stopped on the missing `hast-util-to-string`.

## 0.22.0 (2026-10-31)

One set of icon files on every site, and two fixes to the page graph (search and sharing, area 1).

### Added

- `icons`: the icon files every site serves, at one set of paths (`ICONS`), `iconLinks()` for the root route's `links`,
  `webManifest(site)` for `/site.webmanifest`, and `icoFile(images)`. The `prelum-icons` bin draws favicon.ico (16, 32, 48),
  the 180 pixel Apple touch icon on the brand color, the 192 and 512 pixel icons and a maskable one from one SVG, with
  `@resvg/resvg-js` (a new optional peer).
- `prelum-audit` checks the site's icons with `auditIcons`: `/favicon.ico` must answer an image (error), the home page must
  link an icon (error), an Apple touch icon and a manifest (warnings), and the manifest must name the site and list 192, 512
  and maskable icons (warnings) that all load (error).

### Changed

- devkit v0.20.3. CI now runs devkit's workflow audit (actionlint and zizmor) and its dependency audit (OSV-Scanner), and
  `.no-bloat.json` records the test and comment counts.
- The specimen's `_headers` is written by site-runtime's `headersFile` from the set the Worker sends (`HEADERS_FILE`,
  specimen/headers.mjs), replacing the `{{SITE_HEADERS}}` template in specimen/static/_headers; the /diagrams/* policy is
  built with `buildPolicy`. The page policy drops `connect-src https://cloudflareinsights.com`: the edge-injected beacon
  reports to the site's own /cdn-cgi/rum. No rendered HTML changes, so `RENDER_VERSION` stays.
- The specimen's static text files are served with `charset=utf-8`, and its stylesheets, scripts and fonts with
  `Cross-Origin-Resource-Policy: cross-origin` (site-runtime 0.43.0 `headersFile({ charset: true })`, `corpFor`).

### Fixed

- `defineHead`: a page that passes `fullTitle` no longer puts the site's suffix in its WebPage name and last breadcrumb
  ("Viruses · Germomics" becomes "Viruses") when the site sets `suffix`.
- `defineHead`: with `keepTrailingSlash`, the breadcrumb built from `sections` keeps the trailing slash on each crumb, as the
  canonical does, instead of pointing at the address that redirects.

## 0.21.0 (2026-10-31)

Charts move to Enarratio 0.4 (the charts checklist, area 10).

### Changed

- `RENDER_VERSION` is 8. `:::chart` draws with Enarratio 0.4, so every chart's figure now carries its title and the `alt` as a visible
  finding in the figure's head (`figcaption.enarratio-head`), a screen reader overview, a summary computed from the data, the source
  line with a "Download CSV" link, and "Show data". The author's caption is now `div.enarratio-caption` under the drawing (was a
  `figcaption` above the table). Enarratio is an optional peer at `^0.4.0` (was `^0.3.1`).
- The one data: URL the output may carry is a chart's CSV download: `a[download]` with a percent-encoded `data:text/csv;charset=utf-8,`
  href, allowed by `isCsvDownload` (new in `render-url`) in the render and in `assertSafe`. Markdown cannot write `download`, so an
  author's data: link is still refused (a new hostile input proves it).
- `prelum-chart-audit` reads Capsomer 0.53's frame (`.cap-chart`, a layout around Enarratio's figure); `figure.cap-chart` is now only
  the no-data state.
- The specimen moves to Capsomer v0.53.0, and devkit to v0.20.1 and site-runtime to v0.43.0, the newest releases.

### Added

- `:::chart` attributes: `subtitle`, `notes`, `source` with `source-href`, `byline`, `x-unit` and `y-unit`. A `source-href` without a
  `source` is refused.
- What Enarratio reports about a chart a reader would struggle with (no title, an unlabeled axis, text above grade 9, too many series)
  is a render warning (`warnings`, with the chart's title), for the editor to show. It does not refuse the post.
- A pack's `setup` gets `warn`, to add to the render's warnings.

## 0.20.0 (2026-10-31)

### Added

- `prelum-chart-audit` bin: the live check for charts (area 10). It crawls a site with `crawlSite` and opens every page in
  headless Chromium, with scripts off and in light and dark, and reports each chart's misses against the charts checklist
  as GitHub annotations titled with the item (B1, B2, B3, B18, B27, B28, B30, C1, C2, D6, F) and the page as proof. The CSV
  link, source line and Capsomer frame are warnings until Enarratio 0.4.0 and the frame roll out (`--strict-frame` makes them
  errors). `playwright-core` 1.63.0 and `axe-core` 4.14.0 are new optional peers.

## 0.19.0 (2026-10-30)

### Added

- `prelum-audit` bin: crawls a live site from its sitemap with `crawlSite` and runs `auditPages`, printing each finding as a
  GitHub annotation and exiting 1 on any error (2 when the site does not answer), so a scheduled job goes red the day a page loses its title,
  description or canonical. `--from` fetches from a preview host while canonicals are checked against `--origin`.
- `defineHead` adds a JSON-LD graph to every indexable page: a `WebPage` (or the page's `pageType`, such as
  `CollectionPage`) joined to the site's `website` node by `@id`, and a `BreadcrumbList` from the home page through the
  sections `site.sections` names (`{ "/blog": "Blog" }`) to the page. A page passes its own `breadcrumbs`, or `false` for none.
- `robotsDocument` writes `Content-Signal: search=yes, ai-input=yes, ai-train=no` (`CONTENT_SIGNAL`) in every group;
  `contentSignal` replaces it.
- The share image is one object, `{ url, width, height, type, alt }`. `headTags` now writes `og:image:type`, read from the
  file's extension (`.jpg`, `.png`, `.webp`, `.avif`, `.gif`, `.svg`) when `type` is not given, and cuts
  `twitter:image:alt` at a word to X's 420 characters. A bare URL is still read; the docs and types steer to the object.
- `imageObject(image)` in `schema`: an image's license metadata for Google Images (`contentUrl`, `creditText`,
  `creator: { name, type }`, `copyrightNotice`, `license`, `acquireLicensePage`), or null when none of `creator`,
  `creditText`, `copyrightNotice` and `license` is known, since Google requires one. `pageImage(image)` is the same
  ImageObject without that condition, for `primaryImageOfPage` on a page that is not an article.
- `article`'s `image` takes `{ url, width, height }` objects beside URLs, so a site passes its 16:9, 4:3 and 1:1 crops with
  their sizes; one whose size is given and under `ARTICLE_IMAGE_MIN_PIXELS` (50,000) is refused with the article and image
  named. A URL is written as before.
- The audit's `card-incomplete` warning: a page whose `og:image` is not absolute https, or has no `og:image:type`, `width`,
  `height` or `alt` (a card from a bare URL). `image-alt-filename` warns on an image whose alt is a file name, its own or
  any ending in an image extension. `alt=""` stays right: it is a decorative image.
- The blocks Ghost, WordPress and GitHub give writers, in every site's renderer (`render-blocks.mjs`):
  - Callouts: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` and `[!CAUTION]`, with an optional title after the marker,
    as `<div class="callout callout-note" role="note">` with a `callout-title` paragraph.
  - `:::video{src title captions poster width}` and `::audio{src title transcript}`. Video requires captions (WCAG 1.2.2)
    unless marked `silent`; audio requires a transcript link (WCAG 1.2.1). `preload="metadata"`, no autoplay. A video or
    audio file written as an image is refused instead of becoming a broken `<img>`.
  - `::embed[Title]{url}` for YouTube (no-cookie host), Vimeo (`dnt=1`), Spotify and SoundCloud: a link to the original
    with the player URL beside it, so the page makes no request to the service until a reader clicks. Any other URL is
    refused.
  - `:::gallery` (2 to 9 images, each with alt text), `::button[Label]{href}`, `::bookmark[Title]{url description}`.
  - `width=wide` and `width=full` on `:::figure`, `:::gallery`, `:::video` and `::embed` (classes `width-wide`,
    `width-full`).
  - `:::faq` (moved from Foxhound): Q: and A: lines as a `<dl class="faq">`, returned as `faq` for FAQPage JSON-LD.
  - `::postlink[slug]` and `::postlink[slug|text]` (moved from Foxhound), resolved by `options.postLink`; every slug asked
    for is returned as `postLinks`.
  - `:kbd[…]`, `:abbr[…]{title}`, `:mark[…]`, `:sub[…]`, `:sup[…]`.
  - A fence's `title="app.ts"` wraps the block in `<figure class="code-frame">` with a `code-title` caption.
- Smart punctuation (SmartyPants, Astro's default) with TeX dashes: `--` is an en dash, `---` an em dash.
  `smartPunctuation: false` turns it off. Sites install `remark-smartypants` 3.0.3 beside the other pipeline packages.
- render returns `words`, `readingMinutes`, `excerpt` (the first paragraph, at most 300 characters) and `warnings` (a
  skipped heading level, an image without alt text), counted from the rendered tree.
- `text` module: `wordCount` (Unicode words, Intl.Segmenter), `readingMinutes(words, images)` (238 words a minute after
  Brysbaert 2019, plus Medium's image time) and `excerpt(text, max)`.
- `likeContains(text)` in `search`: a LIKE pattern with `%`, `_` and `\` escaped, for `LIKE ? ESCAPE '\'`.
- `render/enhance`: `enhance({ root, toc, article })`, the reader script for rendered writing, moved from dustinedwards.info:
  reading progress, the table of contents' current section, code copy buttons, heading link copy, footnote previews (WCAG
  1.4.13), the image lightbox, Markdown copy, a link to selected text, and click-to-load embeds that re-check the player host.
- `render/audit` and the `prelum-content` command: the live check for writing. It crawls a site's sitemap and reports more
  than one h1 or none, skipped heading levels, duplicate ids, in-page links that land on nothing, images without alt text or
  a size, markdown leaking into the page, and stored HTML whose `data-render-version` is behind the pipeline.
- The conformance corpus gains 10 hostile inputs for the new blocks (54 in all).

### Changed

- `headTags` sends `robots: max-image-preview:large` on every indexable page, so Google can show the whole share image.
- `RENDER_VERSION` is 7. A decorative image (`![](x)`, `alt=""`) is no longer wrapped in its `image-link`: a link whose only
  content has an empty alt has no name.
- `sitemapDocument`'s `images` docs say what a page passes: the images it shows, a rendered page's `mediaRefs` of form
  `markdown-image` and `figure-directive` made absolute URLs again.
- An h1 in a body moves every heading down a level: the page's title is its h1.
- A single tilde is text (`H~2~O`); strikethrough is `~~…~~` only.
- The `assertSafe` allowlist covers h4 to h6, which it refused before, and every element the new blocks write.

### Removed

- `readingMinutes(text)` from `head`, added in 0.18.0 and imported by no site: `text`'s `readingMinutes` is the one rule.

## 0.18.0 (2026-10-30)

### Added

- `robotsResponse`, `aiTxtResponse` (`robots`) and `llmsResponse` (`llms`): the whole /robots.txt, /ai.txt and /llms.txt
  routes the sites each wrote. Each takes `{ origin, request }` with the document's own input; a request on another origin
  is a preview (`preview` overrides it), so robots.txt tells every crawler `Disallow: /`. robots.txt's notes default to
  `robotsNotes(origin)` (the ai.txt and llms.txt pointers). All three carry one set of headers from `plainTextResponse`:
  `text/plain; charset=utf-8`, `PLAIN_TEXT_CACHE_CONTROL` (`public, max-age=3600`, or `no-store` on a preview), the TDMRep
  header, and `X-Robots-Tag: noindex` on ai.txt, llms.txt and any preview. `headers` adds or replaces one. `llmsResponse`
  takes the `llmsDocument` parts or a finished `body`.
- `defineHead({ origin, siteName, image, suffix, locale, feeds })` in `head`, returning `(page) => HeadTag[]`: the wrapper
  around `headTags` every site wrote. The `<title>` is `searchTitle(title, suffix)` unless the page says `fullTitle`, the
  share card keeps the whole title, and the description is cut at a word to `SERP_DESCRIPTION_LIMIT` with the share card
  keeping it whole.
- `headTags` takes `feeds: [{ type, href, title }]` and links each with `<link rel="alternate">` (`rss`, `atom` and `json`
  name their media types). A link tag can carry a `title`, and `headHtml` writes it.
- `metaText(html, limit)`: a meta tag's text from HTML (tags dropped, entities decoded, cut at a word, by default to
  `SERP_DESCRIPTION_LIMIT`). `readingMinutes(text)`: words over 200, rounded, at least one.
- `markdownResponse` takes `vary: false`, for a copy served only at its `.md` URL, and `links`, more `Link` values after the
  canonical one. `prefersMarkdown` also takes the request itself.

### Changed

- The canonical and `og:url` drop a trailing slash on `path` (`/about/` is `/about`; the home page stays `/`), so one page
  has one canonical URL. `keepTrailingSlash: true` keeps it for a route served only with its slash. A `canonical` passed
  in is kept as it is.
- `headHtml` reads a link descriptor before a title, as React Router does.
- The specimen moves to Capsomer v0.37.0 (exact times in American English) and site-runtime v0.27.0, the newest releases.

## 0.17.0 (2026-10-29)

### Added

- llms-full.txt, after Cloudflare's Nimbus (MIT; its notice is in `llms.mjs`): `llmsFullDocument({ title, summary, intro,
  pages })` writes llms.txt's own header, then every page in full. The header is the same code as `llmsDocument`'s.
- A Markdown copy of each page for agents, in `llms`: `markdownPage` writes it (title, description, `Source:` line, body), and
  llms-full.txt is made of the same text. `markdownPath` says where it lives (`/post.md`, `/index.md`), `prefersMarkdown` reads
  an Accept header (Nimbus's code: Markdown only when it outranks HTML and every wildcard) and `markdownResponse` serves it
  with `Vary: Accept` and a canonical `Link` header back to the page.
- `headTags` takes `markdown`, the copy's path, and links it with `<link rel="alternate" type="text/markdown">`. `headHtml`
  writes a link's `type`.
- `frontmatter(source)`: a Markdown file's `---` header as `{ data, body }` (`key: value`, `key: [a, b]` and `- item` lists),
  the parser Capsomer wrote twice, so Capsomer can drop its copies. The specimen reads its element headers with it.
- `rssDocument` and `jsonFeedDocument` take `language` (`en-us` and `en-US` by default, as before).

### Changed

- `RENDER_VERSION` is 6. A heading that ends in `#` ("Learning C#") kept its `#` in the HTML but lost it in `toc`; the
  outline now keeps it. The HTML is unchanged.
- A reference-style image (`![alt][ref]`) is recorded in `mediaRefs` as `markdown-image`, not `link`.
- `render` asks `resolveImage` once per src in a render, so an image used twice is looked up once.
- A feed date that is not a date is refused with an error naming the post and the value. RSS wrote `Invalid Date`, and Atom
  and JSON Feed failed with an unnamed `RangeError`.
- An Atom entry's `<id>` is the post's `guid` when it has one, as RSS's `<guid>` is, so a renamed post is not announced
  again. A site with guids sees each Atom entry's id change once.
- A JSON Feed item's `image` keeps an absolute cover URL as it is; it was written after the origin.
- `sitemapDocument` writes a URL listed twice once, the first time, and refuses `changefreq` or `priority` in the compact
  layout, which dropped them without a word. The expanded layout still writes them.
- The specimen's page policy drops `style-src-elem 'self'`, which said no more than `style-src 'self'`.

### Removed

- `escapeXmlText` and `absolutiseUrls` (the old spelling of `absolutizeUrls`) from `xml`. No site uses either.

## 0.16.0 (2026-10-29)

### Added

- Images can be offered in more than one format, as Astro's `<Picture>` does. `media.imageProps` may return `sources`, each a
  MIME type and a srcset (AVIF first); the image is then wrapped in `<picture>` with one `<source>` per format, and the
  `<img>` keeps its own srcset as the fallback. Every source is held to the same URL policy as the srcset, so one bad
  candidate drops that source alone. site-runtime's `./image` writes `sources`. `RENDER_VERSION` is 5: a site that passes
  `sources` gets new HTML, and the allowlist gains `picture` and `source`.

### Changed

- The specimen moves to Capsomer v0.35.0: in dark, muted text, links and borders are stronger, and with "Increase contrast" on it takes Capsomer's stronger set.
- Peer dependencies: `@mermaid-js/mermaid-cli` 11.17.0, `puppeteer` 25.16.0, `linkedom` 0.18.14 and `unist-util-visit` 5.2.0. The specimen's diagrams draw the same; only their stamp names the new Mermaid.
- The specimen moves to Capsomer v0.34.1, so a short page keeps the scrollbar's room and its letterhead sits on the same pixels as a long page's.
- The specimen moves to Capsomer v0.34.0. Home starts at the same place as on every family site, x 496 at 1536px, whatever the site's name.
- The specimen wears the family letterhead (Capsomer v0.28.1, `letterheadHtml`): the cerulean stripe over the band, the mark
  with "Dustin Edwards" over Prelum, and Home, Elements and Outputs in a second row, pinned at the top. It replaces the
  running head sign and the specimen's own skip link. The page has no script, so it follows the system's theme.
- The specimen's page is Capsomer's family column (Capsomer v0.29.0, `.cap-page`), so its letterhead, content and footer
  line up with every other family site. Its own 1180px width and `--header-max` are gone.
- The specimen's footer is Capsomer's family footer as it ships (Capsomer v0.30.0), the same on every family site. Its own
  `.site-foot` spacing and type size are gone, and the page keeps only its top padding.
- devkit v0.14.0, the newest release (its family check now also flags a site's own value for a Capsomer token).
- The specimen moves to Capsomer v0.32.0 and devkit v0.15.0. Its fonts are Capsomer's `fonts.css` and `fonts/` (Schibsted
  Grotesk and Martian Mono, one variable file each), so the footer's bold name is the same face as on every family site; the
  `@fontsource/schibsted-grotesk` and `@fontsource/martian-mono` dev dependencies are gone. The page's own 24px top padding
  is gone, the footer sits in its own `.cap-page` under the page as Capsomer's site sets it, and the 17px body comes from
  Capsomer's `.cap-page`. Rendered HTML is unchanged, so `RENDER_VERSION` stays 4.
- The specimen's letterhead has the family's theme button, as Enarratio's gallery does: Capsomer's `theme-switch` and
  `popover` CSS, `/theme.js` (Capsomer's `applyStoredTheme`, a plain script in the head, so a remembered theme paints first)
  and `/specimen.js` (Capsomer's site header and theme switch `enhance`), both bundled from `specimen/browser/` with rolldown,
  a new dev dependency. The page policy's `script-src 'self'` already allows them; no page has an inline script.
- The specimen's main column starts `--space-6` (24px) below the letterhead, as Enarratio's gallery does, so its first
  heading no longer sits against the band. Rendered HTML is unchanged, so `RENDER_VERSION` stays 4.

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
