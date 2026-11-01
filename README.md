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
| `sitemap` | `sitemapDocument(entries, { layout, lastmodFormat, trailingNewline })`; an entry's `images` (absolute URLs of the images the page shows: a render's `images`, each `src` made absolute) list them in the image sitemap |
| `llms` | `llmsDocument`, `llmsLink`; `llmsFullDocument`, `markdownPage`, `markdownPath`, `prefersMarkdown`, `markdownResponse` (llms-full.txt and each page's Markdown copy); `llmsResponse` (the whole /llms.txt response) |
| `frontmatter` | `frontmatter(source)`: the `---` header of a Markdown file as `{ data, body }`; `splitSource`, `joinSource`, `readKey`, `readList`, `setBlock`, `setRawKey`: read one field and write one block, every other byte as it was (the one reader site-api and Carrel use) |
| `head` | `defineHead(site)` (the per-site builder: `(page) => HeadTag[]`), `headTags(input)` (title, description, canonical, the Markdown copy's and the feeds' links, Open Graph with `og:video`, Twitter, `article:*`), `headHtml(tags)`, `metaText(html, limit)`, `readingMinutes(text)`, `absoluteUrl`, `articleDates`, `searchTitle(title, suffix)`, `truncateForSerp`, `SERP_TITLE_LIMIT`, `SERP_DESCRIPTION_LIMIT` |
| `schema` | `jsonLd`, `thing(type, fields)`, `graph`, `website`, `article`, `breadcrumbs`, `itemList`, `faqPage`, `imageObject(image)` (an image's license metadata), `pageImage(image)` (an ImageObject, for `primaryImageOfPage`), `articleImageSet(crops, rights)` (an Article's 16:9, 4:3 and 1:1 crops), `videoObject(video)`, `ARTICLE_IMAGE_MIN_PIXELS`, `ARTICLE_IMAGE_RATIOS` |
| `robots` | `robotsDocument(input)`, `aiTxt(input)`, `robotsResponse(input)`, `aiTxtResponse(input)` (the whole responses), `plainTextResponse`, `isPreviewRequest`, `robotsNotes`, `PLAIN_TEXT_CACHE_CONTROL`, `TDM_RESERVATION_HEADERS`, `SEARCH_ENGINE_BOTS`, `AI_SEARCH_BOTS`, `AI_TRAINING_BOTS`, `DENIED_BOTS` |
| `indexnow` | `submitIndexNow(input)`, `keyFileResponse(key, headers)` (the `/<key>.txt` file), `recentSitemapUrls(xml, { days })`; the `prelum-indexnow` bin |
| `audit` | `auditPages(pages, { origin, sitemap })`, `crawlSite({ origin, fetch, maxPages, sitemapPath })`; the `prelum-audit` bin |
| `icons` | `ICONS` (the file paths), `iconLinks()`, `webManifest(site)`, `icoFile(images)`, `auditIcons({ origin, fetch })`; the `prelum-icons` bin |
| `audit` | `auditPages(pages, { origin, sitemap })`, `crawlSite({ origin, fetch, maxPages, sitemapPath })`; the `prelum-chart-audit` bin |
| `search` | `ftsLiteral`, `toMatchExpression`, `fuse`, `RRF_K` (D1's FTS5); `staticSearchIndex(pages)` at build and `staticSearch(index, query)` in the browser, `searchWords`, for a site with no database |
| `render`, `render/nomath` | `render`, `RENDER_VERSION`, `ContentError`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_DEPTH`, `isAllowedUrl` |
| `render/packs` | `editorialPack`, the `RenderPack` shape a site's own directives take |
| `render/chart-enhance` (browser) | `enhanceCharts(root?, options?)`: Enarratio's enhancement and the narrow-screen redraw for every `:::chart` |
| `render/highlight` | `createHighlight`, `LANGUAGES`, `SHIKI_THEMES` |
| `render/safe` | `assertSafe`, `scanHtml`, `inventory` |
| `render/conformance` | `HOSTILE_INPUTS`, `runConformance` |
| `render/math`, `render/url` | `htmlHasMath`, `KATEX_OPTIONS`; `isAllowedUrl` |
| `render/link-icons` | `linkIconResponse` (the icon route), `lookupLinkIcon`, `linkIconType`, `linkIconSrc`, `fitLinkIcon` (a fetched icon cut to `LINK_ICON_SIZE`, 32 px, for its 16 px display), `LINK_ICON_PATH`, `LINK_ICON_MAX_BYTES`, `LINK_ICON_TIMEOUT_MS` |
| `render/diagram` | `DIAGRAM_ASSET_DIR`, `DIAGRAM_THEMES`, `diagramAssetPath`: where a `:::diagram`'s drawings live; `DIAGRAM_SIZES_FILE`, `diagramSize`: their sizes |
| `render/diagram-draw` (Node, build time) | `drawDiagrams`, `pruneDiagrams`, `auditDiagramSvg`, `mermaidConfig`, `DIAGRAM_ROLES`, `DIAGRAM_ROLE_NAMES` |

## Search and AI crawlers

`head`, `schema`, `robots` and `indexnow` are what each site wrote for its own `<head>`, JSON-LD, robots.txt and IndexNow
pings, in one form. `headTags` returns the descriptor objects React Router's `meta` export takes, so a route returns it as it is;
a static build writes the same objects with `headHtml`. Each site keeps its own facts (who it is, its sameAs links, its default
card), and passes them in.

What they hold every site to:

- The canonical, `og:url` and every absolute URL come from the site's production origin, never the request's, so a workers.dev
  copy cannot claim to be the page.
- A card image is required, so `twitter:card` is always `summary_large_image`. It is one object, `{ url, width, height, type,
  alt }`, written as `og:image` and its `type`, `width`, `height` and `alt`, and `twitter:image` and `twitter:image:alt` (cut
  to X's 420 characters). `type` is the type the URL is served as: pass it for a resized size (`/media/a.jpg?w=1200` is
  served as WebP or AVIF); only a URL with no query has its type read from its extension, and otherwise none is written. A bare URL is still read, but its card has no size
  or alt and the audit flags it. An absent date writes no tag, and the Open Graph dates and the Article schema's come from one
  `articleDates`.
- An Article's `image` takes several crops (Google asks for 16:9, 4:3 and 1:1), each a URL or `{ url, width, height }`; one
  whose size is given and under 50,000 pixels is refused. `articleImageSet({ "16x9": crop, "4x3": crop, "1x1": crop }, rights)`
  orders them as Google does, gives each the picture's rights, and refuses a crop that is not its ratio. `imageObject` writes an image's license metadata (`contentUrl`,
  `creditText`, `creator`, `copyrightNotice`, `license`, `acquireLicensePage`) for Google Images, and returns null when no
  rights field is known. A page that is not an article names its image with `primaryImageOfPage: pageImage(image)`. A render's
  `images` carry each picture's size and rights from the site's resolver, so `images.map((i) => imageObject({ ...i, url:
  absoluteUrl(origin, i.src) }))` (nulls dropped) is the page's ImageObjects.
- A page's videos (a render's `videos`) go to `headTags({ videos })` as `og:video` with `secure_url`, type and size, and to
  `videoObject({ name, thumbnailUrl, uploadDate, contentUrl | embedUrl, width, height })`, which refuses a video without the
  fields Google requires.
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
or `X-Robots-Tag`); redirect chains; links to broken pages or to redirects; JSON-LD that does not parse; images with no `alt`
(`alt=""` is a decorative image, and right) or a file name for one; and pages with no `og:title` or card image, or a card without
an https URL, type, size or alt. `auditPages` is pure and returns `{ findings, pages, summary }`, `summary` counting
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

Every site serves the same icon files at the same paths (`ICONS`): `/favicon.ico` (16, 32 and 48 pixels, since Google asks for
a multiple of 48 linked from the home page), `/icon.svg`, `/apple-touch-icon.png` (180 pixels on the brand color, since iOS
fills transparency with black), `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png` and `/site.webmanifest`.
`prelum-icons --svg mark.svg --background "#4F2D7F" [--maskable mark-maskable.svg] [--out public]` draws the images from one
SVG, the maskable one with the mark inside the safe circle (W3C, "Icon masks") unless a drawn one is given; it needs
`@resvg/resvg-js`, an optional peer. `iconLinks()` is the root route's `links`, and `webManifest(site)` the manifest's JSON.
`prelum-audit` runs `auditIcons` with the pages: a favicon that does not answer an image, a home page without an icon, Apple
touch icon or manifest link, and a manifest without a name, a 192 and a 512 pixel icon and a maskable one, or with an icon that
does not load.

### Charts in posts

`:::chart{type x y alt title ...}` holds its data as a fenced CSV block, or cites it with `src="..."` (a URL or a media path):
the site's `chartData(src, { file })` loader, passed to `editorialPack`, reads it at render time. Prelum fetches nothing itself,
so a `src` on a site without the loader is refused. A chart with no title, author text above reading grade 9 or too many series
renders with a warning; `editorialPack({ strictCharts: true })` refuses it instead, so an editor can block a publish on it.

The chart is drawn on the server at 700 px, so it reads with scripts off. On a narrower screen Enarratio's frame would keep it
30rem wide and scroll it sideways; `render/chart-enhance` redraws it to the frame's width instead, and adds Enarratio's
enhancement layer (`enarratio/enhance`: keyboard walk between points, focus announcements, tooltips, legend filters, a sortable
table). It reads the `data-prelum-chart` attribute on each frame: bar, line and area charts are drawn again by `enarratio/lite`
(the same SVG as the server's), and a dot chart swaps in a 240 px drawing the server wrote. What a site adds is one import in
the script it already bundles, which keeps it a same-origin module with no inline script, so a hash CSP holds:

```js
import { enhanceCharts } from "@drdustinedwards/site-helpers/render/chart-enhance";
enhanceCharts(); // once the document is parsed; options go to Enarratio's enhance()
```

A site with no bundle of its own bundles that file into one (`rolldown`, `esbuild`) and loads it with
`<script type="module" src="/charts.js"></script>`. `enarratio` (0.4.1 or later) is the one dependency; about 80 kB minified.

`prelum-chart-audit --origin https://example.com [--from <preview origin>] [--chart-kb 100] [--no-strict-frame] [--pages <file | a,b>] [--start <url>]` is the live
check for charts (area 10 of the completeness scoreboard). It crawls with `crawlSite`, then opens every page (and the
same-origin iframes they show) in headless Chromium: with scripts off, and with scripts on in the light and dark schemes. For
every Enarratio chart, or the Capsomer frame (`.cap-chart`, Capsomer 0.53) it sits in, it reports each miss as a GitHub annotation titled
with its checklist item and the page as proof: no SVG, title, finding sentence, caption or data table with scripts off (B2, B18,
B30); an SVG without `role="img"` and a name, or a table without scoped `th` and a caption (B28); text under 4.5:1 or a mark or
legend swatch under 3:1 as painted, custom properties resolved, in either scheme (B1); text under 12 px (B3); an axe-core
violation inside the chart in either scheme (B27); a chart over `--chart-kb` of inline HTML (D6); a page that loads Recharts,
Chart.js, ApexCharts, ECharts, Highcharts, Plotly, Nivo or visx, or draws an SVG chart by hand (F); at 320 px wide, a drawing
that overflows its frame sideways or chart text under 12 px (C12). A missing CSV link (C1), source line (C2) or frame (F) is an
error; `--no-strict-frame` makes them warnings (`--strict-frame` is still accepted and changes nothing).

The SVG's role (B28) follows the WAI-ARIA APG: `role="img"` for a static chart, or `role="group"` with
`aria-roledescription="chart"` for an enhanced one the reader can enter. Before measuring contrast, a `url(#id)` fill or stroke
is read as its pattern's base `<rect>` (Enarratio's textures paint the series color first) or its gradient's first stop.

**Inline primitives.** A sparkline in a stat tile or an uptime strip in a table row is an inline primitive: Enarratio's
`inline: true` output, a bare `[data-enarratio]` sparkline, heat strip, progress ring, uptime strip or timeline in no
`figure.enarratio`, alone or in a frame of its own (a Capsomer stat tile). It needs no frame, title, caption, CSV or table. It
passes when it is `role="img"` with an `aria-label` (or `aria-labelledby`) that states its values or finding (a number, or a
sentence of four words or more), or when it is `aria-hidden="true"` beside visible text that gives the numbers (the nearest
ancestor with text of its own holds a digit). Otherwise it is a B18 error.

`--pages` adds pages the crawl cannot find (a file of URLs or paths, one per line, or a comma list), and each `--start <url>`
is opened first in every browser context, so a demo route that sets a session cookie (Foxhound's `/demos/dashboard`) opens the
pages behind it. It exits 0 with no errors, 1 with any, 2 when it could not run. `playwright-core` and `axe-core` are optional
peers; without them it installs the pinned versions into a cache directory once. It drives Playwright's Chromium, else the
system Chrome, else `CHART_AUDIT_CHROME`.

## Accessibility statement

`accessibilityStatement({ siteName, contact: { href, label }, date, capsomer, links, conformance, limitations, measures })` (`./accessibility`) is
the page every public site serves at `ACCESSIBILITY_PATH` (`/accessibility`; devkit-a11y fails S6 without it). It returns
`{ title, description, body, html }`, the body Markdown (and `html` the same sections as escaped HTML, headings from h2, for a site with no Markdown pipeline) in the W3C WAI generator's sections (the commitment, WCAG 2.2 AA and the
conformance status, measures, known limitations, how to report a problem, the date). The site puts `html` (or `body` rendered with `render`) in its
own layout and links the page from the footer. `limitations` are the open findings of the site's latest devkit-a11y report, one
sentence each; until `conformance` is `"full"` the statement also names the hand checks still owed (NVDA and VoiceOver, signed-in pages).
`capsomer` and `links` are facts about the live site, so each sentence about the build is true of it: `capsomer: true` only
when its pages are built from Capsomer, and `links` as its paragraph links are drawn (`"marked"`, Capsomer's link system with
`capsomer/link.css`; `"underline"`; `"bold"`, a heavier weight than the text). Both are required.

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
blocks every site gets (below), math, the table of contents and the URL policy. What a site decides it injects:

```js
import { render } from "@drdustinedwards/site-helpers/render";
import { editorialPack } from "@drdustinedwards/site-helpers/render/packs";
import { createHighlight } from "@drdustinedwards/site-helpers/render/highlight";

const { html, toc, hasMath, mediaRefs, images, videos, diagrams, blockedUrls, renderVersion, faq, postLinks, words, readingMinutes, excerpt, warnings } =
  await render({
  file: "content/posts/example.md", // for error messages
  body, // markdown with any frontmatter already stripped
  resolveImage, // async (src) => ({ width, height, placeholder?, credit?, license? }): sizes images, a video (its poster) and
                // an embed's poster; credit and license (a URL, or words such as CC BY 4.0) are shown and returned in images
  options: {
    media: { keyOf, imageProps }, // the site's image rules; without them images are left as written. imageProps may return
                                  // sources (AVIF, then WebP, each with an optional media query) to wrap an image in <picture>
    priority, // one { taken: false } per page, passed to every render of that page, so the page has one fetchpriority=high
    packs: [editorialPack({
      assetPrefix: "example-", // chart, diagram, sidenote, pullquote, swatch
      diagramSizes, // the sizes.json drawDiagrams writes beside the drawings; sizes each diagram
      chartData: async (src, { file }) => csvText, // reads :::chart{src="..."}; without it a src is refused
      strictCharts: false, // true refuses a chart with no title, text above grade 9 or too many series
    })],
    highlight: createHighlight({ wasm }), // without it a code block is plain <pre><code>
    maxBytes: 512 * 1024, // refused before parsing
    maxDepth: 100, // refused after parsing
    assertSafe: true, // scan the output and throw on anything outside the allowlist; off by default
    postLink: async (slug) => ({ url, title }), // resolves ::postlink[slug]; null leaves it visible as code
    smartPunctuation: true, // curly quotes, -- en dash, --- em dash; the default
    links: { origin, family: FAMILY_SITES, fileSize }, // the link contract (below); FAMILY_SITES is Capsomer's
    linkIcons: { store }, // an away link's icon, fetched once at publish (below); without it nothing is fetched
  },
});
```

**What writers get**, measured against Ghost's cards, WordPress's core blocks, GitHub's alerts and Astro's defaults. Each block
refuses what it cannot render well, with the line and the fix:

| Write | Renders |
| --- | --- |
| CommonMark and GFM: tables, task lists, `~~strike~~`, autolinks, footnotes | Scrollable tables, labeled checkboxes, footnotes with back links |
| `> [!NOTE]` (TIP, IMPORTANT, WARNING, CAUTION), optional title after it | `<div class="callout callout-note" role="note">` |
| `:::figure{src alt credit dark width}` | Figure, caption, credit, a dark-theme twin; `width=wide` or `width=full` |
| `:::gallery` with 2 to 9 images | `<figure class="gallery">` grid |
| `:::video{src title captions poster}`, `::audio{src title transcript}` | Native players; captions (or `silent`) and a poster, or a transcript, required. The video takes its poster's size; audio preloads nothing |
| `::embed[Title]{url poster}` (YouTube, TikTok, Spotify, SoundCloud, Apple Podcasts, Amazon Music, Google Maps, X, Bluesky, Instagram) | A lite embed: the site's own poster (optional), a play button for video and audio, and the title, in a link carrying the player URL; `render/enhance` loads the player on a click. The site declares site-runtime's `embeds` opt-in, which lets the players into its CSP and Permissions-Policy |
| `![alt](src)`, `![""](src)` | An image; one with no alt is refused, and `![""](src)` marks a decorative one. The library's credit and license show under it |
| `::button[Label]{href}`, `::bookmark[Title]{url description}` | A button link, a link card |
| `:::details{summary}`, `:::faq` with Q: and A: lines | Native `<details>`, a `<dl class="faq">` returned as `faq` |
| `::postlink[slug\|text]` | A link to the post's current address |
| `:lang[[Leer en español](url)]{hreflang=es}`, `:xref[[Figure 2](#figure-2)]` | A link in another language, named in itself; an author's cross-reference |
| `:kbd[]`, `:abbr[]{title}`, `:mark[]`, `:sub[]`, `:sup[]` | The inline elements raw HTML would need |
| ```` ```js title="app.ts" {2} ```` | Highlighted code with a file name and marked lines |

An h1 in the body moves every heading down a level, quotes and dashes are typeset (SmartyPants, `--` en, `---` em), and a
skipped heading level, a diagram not drawn yet or a video whose poster has no size comes back in `warnings` for the editor to show.

**Images.** The first image of a render is eager with `fetchpriority=high` and every other is lazy; a page that renders several
bodies passes one `priority` object to all of them, so only the page's first image takes it (`false`, or `{ taken: true }` when
the page's LCP image is outside the body, gives the body none). An animation whose sources include its still under
`(prefers-reduced-motion: reduce)` (site-runtime's ./image writes them for a GIF) moves for readers who allow motion and gets a
**Pause animation** checkbox for everyone (WCAG 2.2.2): `<span class="motion">` holds the animation, its still
(`picture.motion-still`, hidden by an inline style) and `label.motion-pause`. The site's stylesheet shows the still and hides the
animation while the box is checked, and hides the control under reduced motion (the specimen's `site.css` has the rules; the still
needs `display: block !important` to outrank its inline style). The library's credit and license appear as `span.figure-credit`
in the image's figure caption unless the author wrote one, and a paragraph that holds only the image becomes
`figure.image-figure` to carry it. `words`, `readingMinutes`
(the `text` module's rule) and `excerpt` are counted from the rendered tree.

**A site with no math** imports `render` from `render/nomath` instead: the same pipeline and options, with `$` as plain text (so
`$3,000 to $6,500` is prices, not an expression) and `hasMath` always false. KaTeX, remark-math and rehype-katex are imported only by
`render`, so they never enter that site's bundle (about 1.6 MB raw) and need not be installed.

The output is a fragment: no `<html>`, no layout. A site gives it its own layout and its own CSS for the classes the pipeline emits
(`heading-anchor`, `table-scroll`, `image-link`, `post-details`, `figure-credit`, `figure-light`, `figure-dark`, `width-wide`, `width-full`,
`callout`, `callout-<type>`, `callout-title`, `media`, `media-video`, `media-audio`, `media-transcript`, `embed`, `embed-<service>`,
`embed-link`, `gallery`, `gallery-grid`, `button-row`, `button`, `bookmark` and its parts, `faq`, `faq-item`, `code-frame`,
`code-title`, `image-figure`, `motion`, `motion-still`, `motion-pause`, `embed-poster`, `embed-play`, `embed-label`, the link contract's `cap-link-meta`, `cap-link-icon` and `cap-sr-only`, and a pack's own); a change to one of them is a new
`renderVersion`. A box that can scroll sideways is a named region a keyboard can focus: a table sits in
`<div class="table-scroll" tabindex="0" role="region" aria-label="Table: Sample, Reads">`, and every `pre` carries `tabindex="0"`,
`role="region"` and `aria-label="Code: <frame title or language>"`. An image links to its original (`image-link`) unless it is decorative: `![""](x)` writes `alt=""` and no link,
which would have no name.

**Links say what they are** (the family's link contract, which Capsomer styles from the markup alone). Every link the author
wrote gets one `data-link` kind, the first that fits in this order; the pipeline's own links (heading anchors, image links, buttons,
bookmarks, embeds, a chart's CSV) and GFM's footnote references keep their markup:

| Kind | When |
| --- | --- |
| `xref` | `:xref[[text](url)]`: the author marked it a cross-reference |
| `lang`, `hreflang` | `:lang[[text](url)]{hreflang=es}`; the tag is canonicalized and an unknown one refused. A following `<span class="cap-link-meta" lang="es">Español</span>` names the language in itself |
| `jump` | the href is a `#fragment` |
| `file` | the URL's path (not its query, fragment or host) ends in a file extension (PDF, Word, Excel, PowerPoint, OpenDocument, CSV, TSV, RTF, EPUB, ZIP, GZ, 7Z, audio, video, images, ICS, BIB, RIS); a following `<span class="cap-link-meta">PDF, 2.1 MB</span>`, the size from `links.fileSize(href)` and left out when it returns null |
| `address` | the text is the link's own URL (scheme, `www.` and a trailing slash aside), a DOI, or the mailto's address |
| `email`, `phone` | `mailto:` or `tel:` (tel: is allowed by the URL policy for this) |
| `next` | the only content of a paragraph of the author's own, with words: not a list item's paragraph, not a linked picture |
| `family`, `data-site` | the host is a family site, matched on `links.family` (Capsomer's `FAMILY_SITES`, `www.` aside) |
| `away`, `rel="external"` | the host is neither `links.origin`'s nor a family site's; without `links.origin` no link is away |

The host facts hold whatever the kind: a link off the family carries `rel="external"` and `<span class="cap-sr-only"> (opens another
site)</span>` inside it, and a family link its `data-site`. Prelum does not depend on Capsomer: a site passes `FAMILY_SITES` from
`capsomer/behavior/family-footer`.

**Outside sites' icons, fetched once.** With `linkIcons: { store }`, each away host's icon is looked up in the site's store
(`{ get(host) → { bytes, type } | null, put(host, bytes, type) }`, in R2, KV or files) and, on a miss, fetched once from the host
itself, `/favicon.ico` and then its home page's `<link rel="icon">`, never an icon service: https and a public host name only, 64 KB
and 3 s a request (`maxBytes`, `timeoutMs`), the type read from the bytes, and an SVG that holds a script, handler, link out or
`url()` refused. An icon is stored no bigger than its 16 px display needs (32 px, for a 2x screen): a larger PNG is shrunk and a
favicon.ico keeps only its smallest size that covers it (`fitLinkIcon`, in plain web APIs). A host with none is stored empty, so it
is not asked again; an icon stored before 0.28 is shrunk when its entry is deleted and fetched again. The link then opens with
`<img class="cap-link-icon" src="/link-icons/<host>.<ext>" alt="" width="16" height="16">` (`path` moves it); without a store or an icon
it has none and Capsomer draws its arrow. The route is one line, with a year's immutable cache and the site's set for a file it did
not write, site-runtime's `UPLOAD_HEADERS` (nosniff and a sandboxing policy), which it passes:

```js
import { UPLOAD_HEADERS } from "@dustinedwards/site-runtime/headers";
import { linkIconResponse } from "@drdustinedwards/site-helpers/render/link-icons";
const icon = await linkIconResponse(url.pathname, store, { headers: UPLOAD_HEADERS }); // null when the path is not under /link-icons/
if (icon) return icon;
```

**Safe by construction, then checked.** Raw HTML in the source is dropped before it becomes markup, the URL policy runs last, and
KaTeX runs with `trust` off. Those are three options one edit could flip, so `render/safe` scans the rendered output with a parser
(parse5) against an allowlist, and `render/conformance` holds 54 hostile inputs every site runs against its own configured renderer:

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

- `npm run specimen` builds the site into `specimen/dist`, its `_headers` written from the site registry by site-runtime's
  `site-runtime-headers` (the Worker, `specimen/worker.mjs`, is site-runtime's `staticSite` on the same entry); `npm run deploy:specimen`
  builds and deploys it (a merge to `main` deploys it too, through ci.yml's `deploy` job: devkit's shared deploy, which waits for
  `/health` to report the commit and rolls back when the home page does not answer).
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
that paints a color outside the site's palette (`auditDiagramSvg`). It writes each drawing's size to `sizes.json`
(`DIAGRAM_SIZES_FILE`) beside them, which the site passes to `editorialPack({ diagramSizes })`: each diagram `<img>` then carries
its width and height, `loading="lazy"`, `decoding="async"` and `role="img"` (VoiceOver announces an SVG `<img>` by its alt only
with it). A diagram not drawn yet is written unsized, with a warning, until the body is rendered again. A site gives one hex color per role in
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

`test/fixtures/` holds the sites' published output in its captured byte layout, with sample content (example.com) in
place of each site's own words. `PROVENANCE.json` lists the commits. `test/prelum.test.mjs`
holds the package to that output byte for byte. A change here changes what the sites publish, so it comes with a re-captured
fixture and a reviewed diff.

The tests exist to catch two defects in particular. One is an FTS5 term whose embedded quote is not doubled: the term escapes its
quotes and the query language reads the rest. The other is a fusion constant other than 60: every ranking shifts, with no error.

CI runs `npm run lint` (oxlint), `npm run typecheck` (tsc over the modules, their declarations and the tests) and `npm test` on
every pull request.
