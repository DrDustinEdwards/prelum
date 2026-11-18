---
"@drdustinedwards/site-helpers": minor
---

Mythos review round 5. A dot chart's second drawing (`narrow`, the HTML string the browser script puts in under 30rem) goes through the output scan before it is written. The link-icon SVG check refuses any SVG that holds a backslash, since CSS reads `u\rl(` as `url(`. `rehype-katex` now uses the one top-level KaTeX (an npm override), so the check and the drawing run the same version; KaTeX 0.18.2 changes the math markup slightly, so `RENDER_VERSION` is 26 and stored math pages are redrawn.
