---
"@drdustinedwards/site-helpers": patch
---

The output scan (`render/safe`) and the chart figure read HTML with htmlparser2 instead of parse5, so a Worker that renders Markdown no longer carries parse5 (about 159 KB raw). The scan is as strict or stricter: it also refuses a raw `<` in text, an element inside `<title>`, CDATA and declarations, the places where a tokenizer without tree building could read markup differently from a browser, and a parse5 differential in the tests holds it to what a browser's parser finds. Rendered output is byte-identical (golden unchanged). `parse5` and `hast-util-from-html` are no longer peers; the pipeline needs `htmlparser2` and `hastscript`. The allowlist's SVG attribute pairs are now lowercase (`svg viewbox`), as the scan compares them.
