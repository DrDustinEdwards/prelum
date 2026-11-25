---
"@drdustinedwards/site-helpers": patch
---

Split the audit module: the crawl and the page readers move to `audit-crawl.mjs` and `audit-read.mjs`. `crawlSite` and `auditPages` are still imported from `@drdustinedwards/site-helpers/audit`.
