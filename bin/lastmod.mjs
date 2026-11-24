#!/usr/bin/env node
// prelum-lastmod: after prelum-markdown, give each URL in a static site's sitemap.xml the day its page last changed, and write
// build.json for the next build to compare against (the live copy at <origin>/build.json).
//
//   prelum-lastmod --dir dist --origin https://example.com [--ignore v1.2.3]
// --ignore leaves text out of the page's hash, such as the release number a page prints, so a release is no edit.

import { parseArgs } from "node:util";

import { writeSitemapLastmod } from "../markdown-files.mjs";

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    origin: { type: "string" },
    previous: { type: "string" },
    ignore: { type: "string", multiple: true },
  },
});
if (!values.dir || !values.origin) {
  console.error(
    "usage: prelum-lastmod --dir dist --origin https://example.com [--previous url|file] [--ignore text]...",
  );
  process.exit(2);
}
const record = await writeSitemapLastmod({
  dir: values.dir,
  origin: values.origin,
  previous: values.previous,
  ignore: values.ignore,
});
console.log(
  `prelum-lastmod: ${Object.keys(record).length} pages dated in ${values.dir}/sitemap.xml`,
);
