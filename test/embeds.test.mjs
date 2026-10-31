import assert from "node:assert/strict";
import test from "node:test";
import { EMBED_FRAME_SOURCES } from "@dustinedwards/site-runtime/embeds";
import { EMBED_PROVIDERS, embedPlayerUrl } from "../render-embeds.mjs";

/** @param {string} url */
function player(url) {
  for (const p of EMBED_PROVIDERS) {
    const m = p.pattern.exec(url);
    if (m) return p.player(m, url);
  }
  return null;
}

test("each service's URL becomes its player, built only from the checked parts, and the click check accepts only those players", () => {
  const cases = [
    ["https://www.tiktok.com/@example/video/7300000000000000001?lang=en", "https://www.tiktok.com/player/v1/7300000000000000001?autoplay=1"],
    ["https://podcasts.apple.com/us/podcast/an-example-show/id1200000001?i=1000600000001", "https://embed.podcasts.apple.com/us/podcast/an-example-show/id1200000001?i=1000600000001"],
    // Amazon's own embed src: its three parameters kept, anything else dropped.
    ["https://music.amazon.com/embed/B07WWHZ4J2/?id=8LXAMTYKXJ&marketplaceId=ATVPDKIKX0DER&musicTerritory=US&x=%22%3E", "https://music.amazon.com/embed/B07WWHZ4J2/?id=8LXAMTYKXJ&marketplaceId=ATVPDKIKX0DER&musicTerritory=US"],
    ["https://music.amazon.co.uk/embed/B07WWHZ4J2/", "https://music.amazon.co.uk/embed/B07WWHZ4J2/"],
    ["https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3000!2d-97.7!3d30.2", "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3000!2d-97.7!3d30.2"],
    ["https://x.com/example/status/1850000000000000001?s=20", "https://platform.twitter.com/embed/Tweet.html?id=1850000000000000001&dnt=true"],
    ["https://twitter.com/example/status/1850000000000000001", "https://platform.twitter.com/embed/Tweet.html?id=1850000000000000001&dnt=true"],
    ["https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/post/3l6oveex3ii2l", "https://embed.bsky.app/embed/did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l"],
    ["https://www.instagram.com/reel/C0abcDEF123/?igsh=x", "https://www.instagram.com/reel/C0abcDEF123/embed/"],
  ];
  for (const [url, expected] of cases) {
    assert.equal(player(url), expected, url);
    assert.equal(embedPlayerUrl(expected), expected, expected);
  }
  // Lookalikes and injected text match no service.
  for (const url of [
    "https://www.google.com/maps/place/Austin",
    "https://www.google.com/maps/embed?pb=!1m2\"onload=x",
    "https://music.amazon.com/albums/B07WWHZ4J2",
    "https://x.com.example.com/example/status/1850000000000000001",
    "https://vimeo.com/123456789",
  ]) {
    assert.equal(player(url), null, url);
  }
  // A known origin on another path, or another origin, is not a player.
  assert.equal(embedPlayerUrl("https://www.google.com/search?q=x"), null);
  assert.equal(embedPlayerUrl("https://www.instagram.com.example.com/p/x/embed/"), null);
  assert.equal(embedPlayerUrl("javascript:alert(1)"), null);
  // A site lets the players in through site-runtime's list, so every player built here must be on it.
  assert.deepEqual(EMBED_PROVIDERS.map((p) => p.origin).filter((o) => !EMBED_FRAME_SOURCES.includes(o)), []);
});
