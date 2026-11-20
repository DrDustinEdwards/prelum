import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// An exact peer version is the one the tests run against. Renovate moves dev dependencies and never peers, so
// the two drift apart and a site on the newer version fails npm's peer check when it refreshes its lockfile.
test("exact peer versions equal the dev dependencies", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const drift = [];
  for (const [name, range] of Object.entries(pkg.peerDependencies)) {
    const dev = pkg.devDependencies[name];
    if (/^\d/.test(range) && dev && dev !== range) drift.push(`${name}: peer ${range}, dev ${dev}`);
  }
  assert.deepEqual(drift, []);
});
