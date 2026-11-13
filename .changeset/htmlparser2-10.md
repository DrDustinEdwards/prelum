---
"@drdustinedwards/site-helpers": patch
---

**`markdown-copy` accepts htmlparser2 10 as well as 12.** It uses only the `Parser` callbacks, which are the same in both, so a site whose Worker already carries htmlparser2 10 through linkedom shares that copy instead of adding a second. The Markdown is byte for byte the same on seven dustinedwards.info pages, and the markdown-copy tests pass on both. dustinedwards.info's Worker: 5947 to 5919 KiB raw, 1717 to 1712 KiB gzip.
