import assert from "node:assert/strict";
import { test } from "node:test";

import { staticSearch, staticSearchIndex } from "../search.mjs";

const index = staticSearchIndex([
  { url: "/components/button/", title: "Button", summary: "The one button.", headings: [{ id: "doc-sizes", text: "Sizes" }], text: "A button starts an action. Sizes run small to large." },
  { url: "/components/badge/", title: "Badge", summary: "A count or a state.", text: "Sits beside a button's label to show a count." },
  { url: "/components/cafe/", title: "Café menu", text: "Nothing else." },
]);

test("every word must match, the last as a prefix, earlier ones whole; the title outranks the text; accents fold", () => {
  assert.deepEqual(staticSearch(index, "butt").map((r) => r.title), ["Button", "Badge"]);
  assert.deepEqual(staticSearch(index, "button sizes").map((r) => r.url), ["/components/button/#doc-sizes"]);
  assert.deepEqual(staticSearch(index, "but count"), []);
  assert.deepEqual(staticSearch(index, "cafe").map((r) => r.title), ["Café menu"]);
  assert.deepEqual(staticSearch(index, "  "), []);
});
