---
"@drdustinedwards/site-helpers": minor
---

Remove the exports no site uses, and keep the constants and helpers that only their own module reads private.

Removed from `schema`: `softwareApplication`, `scholarlyArticle`, `scholarlyType`, `postalAddress`, `ARTICLE_IMAGE_MIN_PIXELS` and the `ARTICLE_IMAGE_RATIOS` re-export (import it from `@dustinedwards/site-runtime/image`). No longer exported: `ACCESSIBILITY_STANDARD`, `CONTENT_SIGNAL`, `DISALLOW_ALL`, `PLAIN_TEXT_CACHE_CONTROL`, `isPreviewRequest`, `robotsNotes`, `DIAGRAM_ROLES`, `mermaidConfig`, `LINK_ICON_SIZE`, `LINK_ICON_MAX_BYTES`, `LINK_ICON_TIMEOUT_MS`, `RENDER_VERSION_ATTRIBUTE`, `SHARE_CARD_SIZE`, `SITEMAP_MAX_BYTES`, `ZERO_RESULT_MAX_LENGTH`, `WORDS_PER_MINUTE`, `GRAMMARS`, `remarkSwatch`, `remarkSidenote`, `remarkPullQuote` and `remarkChartSource` (the editorial pack still uses them).
