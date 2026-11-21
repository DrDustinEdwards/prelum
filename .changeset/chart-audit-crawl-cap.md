---
"@drdustinedwards/site-helpers": patch
---

prelum-chart-audit reads at most `--max-pages` pages from the sitemap before it opens a browser, instead of always fetching up to 3,000 one at a time. On a 2,200-page site with `--max-pages 30` it took 25 seconds, not 3 minutes.
