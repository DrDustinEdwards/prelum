import assert from "node:assert/strict";
import { test } from "node:test";

import { slugify } from "../slug.mjs";

test("accents fold, other runs are one hyphen, and a cut ends on a whole word with no trailing hyphen", () => {
  assert.equal(slugify("  Café — Naïve: Ünïcode!  "), "cafe-naive-unicode");
  assert.equal(slugify("The quick brown fox", { max: 10 }), "the-quick");
  assert.equal(slugify("¿?"), "");
});
