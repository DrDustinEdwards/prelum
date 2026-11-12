import assert from "node:assert/strict";
import { test } from "node:test";

import { SLUG_PATTERN, slugify, uniqueSlug } from "../slug.mjs";

test("accents fold, other runs are one hyphen, and a cut ends on a whole word with no trailing hyphen", () => {
  assert.equal(slugify("  Café — Naïve: Ünïcode!  "), "cafe-naive-unicode");
  assert.equal(slugify("The quick brown fox", { max: 10 }), "the-quick");
  assert.equal(slugify("¿?"), "");
});

test("uniqueSlug counts past taken slugs, stays within max, and falls back to a random suffix", async () => {
  const held = new Set(["my-club", "my-club-2"]);
  assert.equal(await uniqueSlug("My Club", { taken: (s) => held.has(s) }), "my-club-3");
  assert.equal(await uniqueSlug("¿?", { fallback: "club", taken: async () => false }), "club");
  const long = await uniqueSlug("word ".repeat(40), { max: 20, taken: (s) => s === "word-word-word-word" });
  assert.equal(long, "word-word-word-2");
  for (const slug of [await uniqueSlug("A B"), await uniqueSlug("x", { tries: 2, taken: () => true })]) {
    assert.match(slug, /-[a-z0-9]{6}$/);
    assert.match(slug, SLUG_PATTERN);
  }
});
