---
"@drdustinedwards/site-helpers": minor
---

The audit compares a canonical and og:url with the page's own address, trailing slash included, so a canonical on the URL that redirects is a finding. A static site's `.md` copy answers with the page's own canonical (its `Source:` line), slash kept, on GET and HEAD. `prelum-lastmod` takes `--ignore <text>` (repeatable) so a printed release number is no edit. The specimen's 404 page carries `robots: noindex`. `faqPage` is removed: Google no longer shows the FAQ rich result (changelog 2026-05-08), so no site writes the markup.
