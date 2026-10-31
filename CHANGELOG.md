# Changelog

## Unreleased

Images and media (area 6, round 2): diagrams sized, one high image per page, animations that move and can be paused, the library's
credit on the page and in its ImageObjects, a refused missing alt, the served type on the share card, and video posters, lite
embeds, `og:video` and VideoObject.

### Changed

- `RENDER_VERSION` is 13. A site re-renders its stored bodies; one that holds `![](x)` now stops with the line to fix.
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
- `render-version.d.mts` names the version it declares (it still said 10).

### Added

- `schema`: `articleImageSet(crops, rights)` orders an Article's 16:9, 4:3 and 1:1 crops as Google asks, gives each the
  picture's rights and refuses a crop that is not its ratio (`ARTICLE_IMAGE_RATIOS`); `videoObject(video)` writes a VideoObject
  and refuses one without `name`, `thumbnailUrl`, `uploadDate` and a `contentUrl` or `embedUrl`.

### Specimen

- One `fetchpriority=high` on the page (it had three), the diagram sized from its drawing, and MDN's 48 px link icon kept at 32.
- New elements: an image with a library credit, an animated image with its pause control, a decorative image, video, embed,
  audio, gallery, inline marks, button and bookmark, and questions and answers, so every directive a site gets is shown and
  Carrel's Insert menu lists them. The home page writes the ImageObject and VideoObject, `og:video`, and its images in the
  sitemap; the page policy allows `media-src` from the specimen itself.

- Specimen: deployed by devkit's shared deploy (worker-deploy.yml v0.20.18), a `deploy` job in ci.yml after the checks, in place of
  specimen.yml. It deploys with `DEPLOY_SHA`, waits for `/health` (site-runtime 0.60.0's `staticSite`) to report the commit,
  checks the home page and rolls back on a refusal; IndexNow runs after it. No library change.

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
