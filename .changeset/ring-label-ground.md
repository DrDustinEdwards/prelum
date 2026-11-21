---
"@drdustinedwards/site-helpers": patch
---

The chart audit (`prelum-chart-audit`) reads what is behind a label from the shape's own fill, not its bounding box. A label in a sunburst's or gauge's hole, or beside a chord's arcs, was measured against an arc whose box covered the hole, and failed B1 on a white page.
