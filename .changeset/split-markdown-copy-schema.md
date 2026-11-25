---
"@drdustinedwards/site-helpers": patch
---

Split two modules along their seams: `htmlToMarkdown` moves to `markdown-html.mjs` and the schema.org entity builders and node core to `schema-entities.mjs` and `schema-node.mjs`. `./markdown-copy` and `./schema` still export every name they did.
