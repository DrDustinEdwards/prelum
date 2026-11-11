// The standard machine files: each answers at its path with its helper's headers, a preview copy is told to stay out,
// and any other path is left to the site.
import assert from "node:assert/strict";
import { test } from "node:test";
import { standardFiles } from "../files.mjs";

const files = standardFiles({
  origin: "https://example.com",
  disallow: ["/admin"],
  ai: async () => ({ name: "Example Co", contact: "hello@example.com" }),
  manifest: { name: "Example Co", themeColor: "#123456", backgroundColor: "#ffffff" },
  indexNowKey: "0123456789abcdef",
  verification: { "/google0123.html": "google-site-verification: google0123.html" },
});
const at = (/** @type {string} */ url, method = "GET") => files(new Request(url, { method }));

test("each standard file answers at its path, and a preview copy is told to stay out", async () => {
  const robots = await at("https://example.com/robots.txt");
  assert.match(String(await robots?.text()), /Disallow: \/admin/);
  assert.equal(robots?.headers.get("tdm-reservation"), "1");
  const copy = await at("https://example.workers.dev/robots.txt");
  assert.equal(copy?.headers.get("Cache-Control"), "no-store");
  assert.match(String(await copy?.text()), /Disallow: \/\n/);
  assert.equal((await at("https://example.com/ai.txt"))?.headers.get("X-Robots-Tag"), "noindex");
  const manifest = await at("https://example.com/site.webmanifest");
  assert.equal(manifest?.headers.get("Content-Type"), "application/manifest+json; charset=utf-8");
  assert.equal((await manifest?.json())?.theme_color, "#123456");
  assert.equal(
    await (await at("https://example.com/0123456789abcdef.txt"))?.text(),
    "0123456789abcdef",
  );
  assert.equal((await at("https://example.com/google0123.html"))?.status, 200);
  for (const miss of [
    "https://example.com/",
    "https://example.com/google9999.html",
    "https://example.com/toString",
  ])
    assert.equal(await at(miss), null, miss);
  assert.equal(await at("https://example.com/robots.txt", "POST"), null);
});
