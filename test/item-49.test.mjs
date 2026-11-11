import assert from "node:assert/strict";
import { test } from "node:test";

import { RENDER_VERSION } from "../render-version.mjs";
import { hasFilters, parseQuery } from "../search.mjs";
import { siteMapSections } from "../site-map.mjs";
import { storedRender } from "../stored-render.mjs";

test("parseQuery: an operator inside quotes stays text, and tag:2019 stays a filter, not a year", () => {
  const parsed = parseQuery('"tag:x stays" tag:2019 Rabies 2021 8080', {
    operators: ["tag"],
    maxYear: 2030,
  });
  assert.deepEqual(parsed.phrases, ["tag:x stays"]);
  assert.deepEqual(parsed.filters, { tag: ["2019"] });
  assert.equal(parsed.year, 2021);
  assert.deepEqual(parsed.terms, ["Rabies", "8080"]);
  assert.equal(hasFilters(parseQuery("2021", { maxYear: 2030 })), true);
  assert.equal(parseQuery("2021", { maxYear: 2030 }).isEmpty, true);
});

test("siteMapSections: a merged count goes on its index's line, an unmerged one is plain text", () => {
  const sections = [
    { id: "writing", heading: "Writing", to: "/writing", roots: ["/writing"] },
    { id: "site", heading: "Site", to: null, roots: [] },
  ];
  const posts = { key: "posts", label: "Posts", to: "/writing", merge: true };
  const tags = { key: "tags", label: "Tags", to: "/writing", merge: false };
  const out = siteMapSections(
    [
      { path: "/writing/a", title: "A", tally: posts },
      { path: "/privacy", title: "Privacy" },
      { path: "/writing", title: "Writing" },
      { path: "/writing/b", title: "B", tally: posts },
      { path: "/tags/x", title: "x", tally: tags },
    ],
    sections,
  );
  assert.deepEqual(out[0].lines, [
    { to: "/writing", label: "Writing", count: 2 },
    { to: "/writing", label: "Tags", count: 1, plain: true },
  ]);
  assert.deepEqual(out[1].lines, [{ to: "/privacy", label: "Privacy" }]);
});

test("storedRender: a body that no longer renders keeps its last stored HTML", async () => {
  const errors = [];
  const shown = await storedRender(
    { body: "# x", html: "<p>old</p>", version: "1", meta: {} },
    {
      render: async () => {
        throw new Error("bad");
      },
      onError: (error) => errors.push(error),
    },
  );
  assert.equal(shown.html, '<div data-render-version="1"><p>old</p></div>');
  assert.equal(shown.fresh, false);
  assert.equal(errors.length, 1);
  const current = await storedRender(
    { body: "# x", html: "<p>now</p>", version: RENDER_VERSION, meta: {} },
    { render: async () => assert.fail("a current render is not rendered again") },
  );
  assert.equal(current.fresh, true);
});
