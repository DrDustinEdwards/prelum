import assert from "node:assert/strict";
import test from "node:test";

import { recentSitemapUrls, submitIndexNow, submitIndexNowIfChanged } from "../indexnow.mjs";

test("recentSitemapUrls: only pages changed within the window, or every page when the sitemap carries no lastmod", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const xml = `<urlset><url><loc>https://example.com/a?x=1&amp;y=2</loc><lastmod>2026-10-24</lastmod></url>
<url><loc>https://example.com/old</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://example.com/undated</loc></url></urlset>`;
  assert.deepEqual(recentSitemapUrls(xml, { now }), ["https://example.com/a?x=1&y=2"]);
  assert.deepEqual(
    recentSitemapUrls("<urlset><url><loc>https://example.com/</loc></url></urlset>", { now }),
    ["https://example.com/"],
  );
});

test("submitIndexNowIfChanged: one ping per changed set, and a failed ping is tried again", async () => {
  /** @type {Map<string, string>} */
  const store = new Map();
  const kv = {
    /** @param {string} k */
    get: async (k) => store.get(k) ?? null,
    /** @param {string} k @param {string} v */
    put: async (k, v) => void store.set(k, v),
  };
  let calls = 0;
  let ok = false;
  const fetch = async () => (calls++, new Response(null, { status: ok ? 200 : 500 }));
  /** @param {string[]} urls */
  const input = (urls) => ({
    kv,
    hashKey: "h",
    origin: "https://example.com",
    key: "k",
    urls,
    fetch,
  });
  const urls = ["https://example.com/b", "https://example.com/a"];
  assert.equal(await submitIndexNowIfChanged(input(urls)), false);
  ok = true;
  assert.equal(await submitIndexNowIfChanged(input(urls)), true);
  assert.equal(await submitIndexNowIfChanged(input([...urls].reverse())), false);
  // The 500 tried each of the three engines; the retry went through the first.
  assert.equal(calls, 4);
});

test("submitIndexNow tries the next engine on a 429, a 5xx or a network error, and stops on a refused key", async () => {
  /** @type {string[]} */
  const hosts = [];
  const answers = [429, "throw", 202];
  const fetch = async (/** @type {any} */ url) => {
    hosts.push(new URL(String(url)).host);
    const next = answers.shift();
    if (next === "throw") throw new Error("down");
    return new Response(null, { status: /** @type {number} */ (next) });
  };
  const input = { origin: "https://example.com", key: "k", urls: ["https://example.com/a"], fetch };
  assert.equal(await submitIndexNow(input), true);
  assert.deepEqual(hosts, ["api.indexnow.org", "www.bing.com", "yandex.com"]);
  hosts.length = 0;
  answers.push(403);
  assert.equal(await submitIndexNow(input), false);
  assert.deepEqual(hosts, ["api.indexnow.org"]);
});
