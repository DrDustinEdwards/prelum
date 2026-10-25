import assert from "node:assert/strict";
import test from "node:test";

import { recentSitemapUrls } from "../indexnow.mjs";

test("recentSitemapUrls: only pages changed within the window, or every page when the sitemap carries no lastmod", () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const xml = `<urlset><url><loc>https://example.com/a?x=1&amp;y=2</loc><lastmod>2026-10-24</lastmod></url>
<url><loc>https://example.com/old</loc><lastmod>2026-01-01</lastmod></url><url><loc>https://example.com/undated</loc></url></urlset>`;
  assert.deepEqual(recentSitemapUrls(xml, { now }), ["https://example.com/a?x=1&y=2"]);
  assert.deepEqual(recentSitemapUrls("<urlset><url><loc>https://example.com/</loc></url></urlset>", { now }), ["https://example.com/"]);
});
