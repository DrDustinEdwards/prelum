---
"@drdustinedwards/site-helpers": patch
---

The output scan's allowlist now covers a zero-value bar. Enarratio draws it as a `rect` with its datum attributes (and `x`, `y`) where other bars are paths; the corpus had no zero bar, so a post with one failed `assertSafe`. A fixture with a zero bar is added to the corpus.
