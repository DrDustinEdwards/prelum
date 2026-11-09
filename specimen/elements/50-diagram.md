---
name: Diagram
summary: A hand-built diagram in the page, one drawing for light and dark.
---
<figure class="blog-diagram" role="img" aria-label="Diagram: from draft to page">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 56" width="432" height="56">
<title>From draft to page</title>
<desc>Three boxes in a row: Draft points to Prelum, which points to Page.</desc>
<defs>
<marker id="diagram-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
<path class="arrow-head" fill="var(--line-strong)" d="M0 0 L10 5 L0 10 Z"/>
</marker>
</defs>
<rect class="node" x="0" y="8" width="120" height="40" rx="8"/>
<text class="label" x="60" y="28" text-anchor="middle" dominant-baseline="central">Draft</text>
<path class="connector" d="M120 28 H154" marker-end="url(#diagram-arrow)"/>
<rect class="node" x="156" y="8" width="120" height="40" rx="8"/>
<text class="label" x="216" y="28" text-anchor="middle" dominant-baseline="central">Prelum</text>
<path class="connector" d="M276 28 H310" marker-end="url(#diagram-arrow)"/>
<rect class="node" x="312" y="8" width="120" height="40" rx="8"/>
<text class="label" x="372" y="28" text-anchor="middle" dominant-baseline="central">Page</text>
</svg>
</figure>
