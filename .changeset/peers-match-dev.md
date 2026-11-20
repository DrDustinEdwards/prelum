---
"@drdustinedwards/site-helpers": patch
---

The exact peer versions match the versions the tests run against again (shiki 4.6.0, parse5 8.1.1, puppeteer 25.17.0 and seven more). The weekly update had moved the dev dependencies only, so a site on the newer versions could not refresh its lockfile. A test now fails when the two differ.
