---
"@drdustinedwards/site-helpers": patch
---

site-runtime is no longer a peer dependency. Every site already depends on it directly, and the peer broke the lockfile
whenever a site moved site-runtime and Prelum together (Renovate's "network packages" update): npm resolves a missing
peer from the registry, where site-runtime is not published, so `npm install` failed with ERESOLVE in every repo. Prelum
still needs site-runtime (>=0.143.0) installed beside it; devkit-shared's pin check keeps every site on a current one.
