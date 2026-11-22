---
"@drdustinedwards/site-helpers": patch
---

A `:::chart` scatter plot is marked `data-keep-shape` with its phone drawing's height, so on a phone the wide drawing is shown at that height until the phone drawing swaps in, and the text under the chart no longer moves (D5).

RENDER_VERSION is 27: a `:::chart` scatter plot's output gains `data-keep-shape` and a `--cap-narrow-height` style. Capsomer 0.164.5 or later draws it.
