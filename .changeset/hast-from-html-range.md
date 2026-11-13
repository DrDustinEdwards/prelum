---
"@drdustinedwards/site-helpers": patch
---

The optional peer `hast-util-from-html` takes `^2.1.0` instead of exactly 2.0.3. 2.1.0 parses with parse5 8, the version Prelum already uses, so a site that installs it bundles one parse5 and one `entities` instead of two of each (dustinedwards.info's Worker: about 47 KiB gzip less). An exact pin on a peer forced every site onto 2.0.3; the range lets a site take a fixed or deduplicated release without waiting for Prelum.
