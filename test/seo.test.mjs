// The parts of the SEO helpers a mistake in would ship silently: a named robots group that drops the disallow list opens every
// private path to that crawler; an empty date tag claims a page has no date; and `</script>` in a title would end the JSON-LD.

import assert from "node:assert/strict";
import test from "node:test";

import { headHtml, headTags } from "../head.mjs";
import { DENIED_BOTS, robotsDocument } from "../robots.mjs";
import { article, jsonLd } from "../schema.mjs";

const ORIGIN = "https://example.com";

test("every named robots group carries the whole disallow list, and a denied bot gets Disallow: /", () => {
  const disallow = ["/admin", "/preview/"];
  const groups = robotsDocument({ origin: ORIGIN, disallow }).split("\n\n");
  const allowGroups = groups.filter((group) => group.includes("Allow: /\n") || group.endsWith("Allow: /"));
  assert.ok(allowGroups.length > 1);
  for (const group of allowGroups) {
    for (const path of disallow) assert.ok(group.includes(`Disallow: ${path}`), group);
  }
  for (const bot of DENIED_BOTS) {
    assert.ok(groups.some((group) => group === `User-agent: ${bot}\nDisallow: /`), bot);
  }
  assert.equal(robotsDocument({ origin: ORIGIN, preview: true }), "User-agent: *\nDisallow: /\n");
});

test("a missing or unreadable date writes no tag, and the Article schema agrees with the Open Graph tags", () => {
  const facts = { published: null, modified: "not a date", tags: [] };
  const tags = headTags({ origin: ORIGIN, path: "/p", title: "T", description: "D", image: "/card.png", article: facts });
  assert.ok(!tags.some((tag) => "property" in tag && tag.property.endsWith("_time")));
  assert.ok(tags.some((tag) => "property" in tag && tag.property === "og:image" && tag.content === `${ORIGIN}/card.png`));

  const dated = { published: "2026-06-21T09:30:00Z" };
  const og = headTags({ origin: ORIGIN, path: "/p", title: "T", description: "D", image: "/c.png", article: dated });
  const schema = article({ url: `${ORIGIN}/p`, headline: "T", ...dated });
  const modified = og.find((tag) => "property" in tag && tag.property === "article:modified_time");
  assert.equal(modified && "content" in modified ? modified.content : undefined, schema.dateModified);
  assert.ok(!("keywords" in schema) && !("description" in schema));
});

test("headHtml escapes attributes and keeps </script> inside JSON-LD from ending the element", () => {
  const html = headHtml([
    { name: "description", content: 'a "quoted" <b>' },
    jsonLd({ headline: "</script><script>alert(1)</script>" }),
  ]);
  assert.ok(html.includes('content="a &quot;quoted&quot; &lt;b&gt;"'));
  assert.equal(html.match(/<\/script>/g)?.length, 1);
  assert.deepEqual(JSON.parse(html.slice(html.indexOf(">", html.indexOf("ld+json")) + 1, html.lastIndexOf("</script>"))), {
    headline: "</script><script>alert(1)</script>",
  });
});
