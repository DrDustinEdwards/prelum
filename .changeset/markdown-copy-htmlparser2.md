---
"@drdustinedwards/site-helpers": minor
---

`markdown-copy` reads the page with htmlparser2 and hastscript instead of `hast-util-from-html` (parse5), so a Worker that wraps itself in `markdownCopies` is about 30 KiB gzip smaller (julieedwards.info: 357.69 to 327.06 KiB) and the copy is made in about two thirds of the time. The Markdown is unchanged: the copies of eight live pages on julieedwards.info, dustinedwards.info and carrel.dustinedwards.info (the CV's 457 KB among them) came out byte for byte the same. A site using `markdownCopies` or `htmlToMarkdown` installs the optional peers `htmlparser2` and `hastscript`; `hast-util-from-html` stays a peer only for the render pipeline.
