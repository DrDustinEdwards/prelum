---
"@drdustinedwards/site-helpers": patch
---

Split the markdown pipeline module: the input limits, table and code regions, image pass and the collecting passes move to `render-limits.mjs`, `render-regions.mjs`, `render-images.mjs` and `render-collect.mjs`. Exports and output are unchanged.
