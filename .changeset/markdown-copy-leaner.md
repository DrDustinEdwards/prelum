---
"@drdustinedwards/site-helpers": patch
---

`markdownCopies` is about 150 bytes smaller in a Worker: one helper reads a `<meta>` tag's content, and a page's facts are passed on as they are instead of copied field by field. The Markdown it writes is unchanged.
