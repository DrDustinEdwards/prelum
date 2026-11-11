import assert from "node:assert/strict";
import test from "node:test";

import { recentSitemapUrls, submitIndexNowIfChanged } from "../indexnow.mjs";

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
  assert.equal(calls, 2);
});
