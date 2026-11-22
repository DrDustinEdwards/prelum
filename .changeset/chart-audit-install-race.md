---
"@drdustinedwards/site-helpers": patch
---

prelum-chart-audit installs its browser tools into a staging directory and moves them into place whole, so two audits starting together no longer find a half-installed cache and fail with "Cannot find module 'playwright-core'".
