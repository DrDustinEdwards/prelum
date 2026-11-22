---
"@drdustinedwards/site-helpers": patch
---

`prelum-chart-audit` no longer crashes with `Cannot find module 'playwright-core'` when several sites run it at once. Each run installed Playwright and axe-core into one shared cache directory, so a second npm install could rewrite it under the first; the install now goes to a directory of its own and is renamed into place, and a cache is used only when both packages are there.
