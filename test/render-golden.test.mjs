// The renderVersion contract: a change to the output for any corpus input is a new renderVersion and a release note. The corpus is
// rendered, hashed, and held to test/fixtures/render/golden.json, which records the version the hashes belong to.
//
// UPDATE_GOLDEN=1 npm test rewrites the file. Bump RENDER_VERSION in render-version.mjs first when any hash changes, and say why in CHANGELOG.md.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";

import { RENDER_VERSION, render } from "../render.mjs";
import { FIXTURES, fixture, resolveImage, siteOptions } from "./render-config.mjs";

const GOLDEN = new URL("./fixtures/render/golden.json", import.meta.url);

test("the corpus renders to the recorded bytes, and a change to them is a new renderVersion", async () => {
  /** @type {Record<string, string>} */
  const hashes = {};
  for (const name of FIXTURES) {
    const { html } = await render({ file: name, body: fixture(name), resolveImage, options: siteOptions });
    hashes[name] = createHash("sha256").update(html).digest("hex");
  }

  if (process.env.UPDATE_GOLDEN === "1") {
    writeFileSync(GOLDEN, `${JSON.stringify({ renderVersion: RENDER_VERSION, hashes }, null, 2)}\n`);
    return;
  }

  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  const changed = FIXTURES.filter((name) => golden.hashes[name] !== hashes[name]);
  if (changed.length > 0 && golden.renderVersion === RENDER_VERSION) {
    assert.fail(
      `the output changed for ${changed.join(", ")} but RENDER_VERSION is still ${RENDER_VERSION}. Bump it in render-version.mjs, then run ` +
        "UPDATE_GOLDEN=1 npm test and describe the change in CHANGELOG.md.",
    );
  }
  assert.equal(golden.renderVersion, RENDER_VERSION, "golden.json belongs to another renderVersion: run UPDATE_GOLDEN=1 npm test");
  assert.deepEqual(hashes, golden.hashes);
});

test("every fixture is recorded, so a new one cannot go unchecked", () => {
  const golden = JSON.parse(readFileSync(GOLDEN, "utf8"));
  assert.deepEqual(Object.keys(golden.hashes).sort(), [...FIXTURES].sort());
});
