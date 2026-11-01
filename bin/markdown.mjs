#!/usr/bin/env node
// prelum-markdown: after a static site builds, write each page's Markdown copy beside it and llms-full.txt, so the Worker
// serves them as files with `serveMarkdownCopies` (from ./llms) and needs no HTML parser.
//
//   prelum-markdown --dir dist --origin https://example.com
//
// Needs hast-util-from-html, hast-util-to-mdast, mdast-util-to-markdown and mdast-util-gfm, optional peers.

import { parseArgs } from "node:util";

import { writeMarkdownCopies } from "../markdown-files.mjs";

const { values } = parseArgs({ options: { dir: { type: "string" }, origin: { type: "string" } } });
if (!values.dir || !values.origin) {
  console.error("usage: prelum-markdown --dir dist --origin https://example.com");
  process.exit(2);
}
const written = await writeMarkdownCopies({ dir: values.dir, origin: values.origin });
console.log(`prelum-markdown: ${written.length} Markdown copies and llms-full.txt in ${values.dir}`);
