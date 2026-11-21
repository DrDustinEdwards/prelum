---
"@drdustinedwards/site-helpers": patch
---

Three fixes to `prelum-chart-audit`, found on live run 44864876132. A label's ground is read from the shape's own fill, not its bounding box: a label in a sunburst's or gauge's hole was measured against an arc whose box covered it, and failed B1 on a white page. An SVG is an "SVG chart drawn outside Enarratio" (F) only when five rects share an edge, as bars share a baseline, so a wireframe's panels and an audio waveform's centered bars no longer count. A `figure.blog-diagram` (Prelum's `:::diagram`) is never counted.
