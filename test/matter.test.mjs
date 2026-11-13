// The YAML frontmatter reader: what gray-matter gave the sites (the fences, a bare date as a Date, the content after the
// closing line), and what it let through that a parser should not.
import assert from "node:assert/strict";
import { test } from "node:test";
import { matter, stringifyMatter } from "../matter.mjs";

test("a mapping with nested values and the content after the closing line", () => {
  const m = matter("---\ntitle: A\ntags: [x, y]\nn:\n  - 1\n  - two\ndraft: true\n---\n\nBody\n");
  assert.deepEqual(m.data, { title: "A", tags: ["x", "y"], n: [1, "two"], draft: true });
  assert.equal(m.content, "\nBody\n");
});

test("a bare date is a Date at UTC midnight, a quoted one is text, and YAML 1.1 guesses stay text", () => {
  const { data } = matter(
    "---\nd: 2026-09-30\nq: '2026-09-30'\nt: 2026-09-30T10:00:00Z\nyes: yes\nh: 1:30\no: 0777\n---\n",
  );
  assert.ok(data.d instanceof Date);
  assert.equal(data.d.toISOString(), "2026-09-30T00:00:00.000Z");
  assert.equal(data.q, "2026-09-30");
  assert.ok(data.t instanceof Date);
  assert.deepEqual([data.yes, data.h, data.o], ["yes", "1:30", 777]);
});

test("no frontmatter, a dash run, comments only, a BOM, CRLF and an unclosed header", () => {
  assert.deepEqual(matter("Just text\n"), { data: {}, content: "Just text\n", matter: "" });
  assert.equal(matter("----\na: 1\n----\n").content, "----\na: 1\n----\n");
  assert.deepEqual(matter("---\n# nothing\n---\nB").data, {});
  assert.equal(matter("﻿---\na: 1\n---\nB").data.a, 1);
  const crlf = matter("---\r\na: 1\r\n---\r\nB\r\n");
  assert.deepEqual([crlf.data, crlf.content], [{ a: 1 }, "B\r\n"]);
  assert.deepEqual([matter("---\na: 1\n").data, matter("---\na: 1\n").content], [{ a: 1 }, ""]);
});

test("a duplicate key, bad YAML and a header that is not a mapping throw", () => {
  assert.throws(() => matter("---\na: 1\na: 2\n---\n"));
  assert.throws(() => matter("---\na: [1\n---\n"));
  assert.throws(() => matter("---\n- a\n- b\n---\n"), TypeError);
  assert.throws(() => matter("---\n!!js/function 'function(){}'\n---\n"));
});

test("stringifyMatter writes a block that reads back, a day as a day, and nothing for empty data", () => {
  const out = stringifyMatter("Body\n", {
    title: "A long title ".repeat(12).trim(),
    d: new Date("2026-09-30"),
    tags: ["x"],
  });
  assert.match(out, /^---\ntitle: A long title .*\nd: 2026-09-30\ntags:\n {2}- x\n---\nBody\n$/);
  assert.equal(out.split("\n")[1]?.length, "title: ".length + 12 * 13 - 1);
  const back = matter(out);
  assert.equal(back.content, "Body\n");
  assert.ok(back.data.d instanceof Date);
  assert.equal(stringifyMatter("Body", {}), "Body\n");
});
