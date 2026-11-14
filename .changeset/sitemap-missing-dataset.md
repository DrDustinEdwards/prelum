---
"@drdustinedwards/site-helpers": minor
---

`auditPages` flags `sitemap-missing` (an error): a page the site links to, with no query string, that is indexable (not noindex, not disallowed to Googlebot, its canonical itself) but is not in the sitemap. `crawlSite` now fetches each linked page with a GET and keeps its HTML, so the audit can read its robots meta and canonical; every robots meta on a page now counts, as Google combines them (a second `noindex` meta was missed before); a linked page that is noindex or disallowed gets no other check. `dataset(input)` (`./schema`) builds a Dataset node with Google's required `name` and `description` required, and the audit reports a Dataset that lacks either.
