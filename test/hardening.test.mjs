// Inputs that used to exhaust time or memory, slip a check or collide: each is one behavior, held to what a reader or a site would see.

import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import test from "node:test";

import { ContentError, render } from "../render.mjs";
import { fitLinkIcon, linkIconType, lookupLinkIcon } from "../render-link-icons.mjs";
import { editorialPack } from "../render-packs.mjs";
import { resolveImage, siteOptions } from "./render-config.mjs";

/** @param {string} body @param {object} [options] */
const core = (body, options = {}) => render({ file: "post.md", body, resolveImage, options });

/** @param {string} body */
const site = (body) => core(body, siteOptions);

/** @param {Promise<unknown>} promise @param {RegExp} message */
const refuses = (promise, message) =>
  assert.rejects(promise, (error) => error instanceof ContentError && message.test(error.message));

test("pathological input under the byte cap is refused in a blink, as a ContentError", async () => {
  for (const body of [
    "[a][a]".repeat(50_000),
    "_a".repeat(100_000),
    ">".repeat(50_000),
    "> ".repeat(100_000),
    "- ".repeat(5000) + "x",
  ]) {
    const started = performance.now();
    await refuses(core(body), /too many links or emphasis marks|nested more than 100 levels/);
    assert.ok(performance.now() - started < 1000, "refused without rendering");
  }
  // Code is not scanned for emphasis marks, and an ordinary list of links is nowhere near the limits.
  await core("```\n" + "_a".repeat(20_000) + "\n```\n\n- [a][1]\n- [b][2]\n\n[1]: /a\n[2]: /b");
});

test("scanLimits raises one limit for a page that needs it, and the others still hold", async () => {
  const names = "`a_b_c` ".repeat(5000);
  await refuses(core(names), /scanLimits option raises them/);
  await core(names, { scanLimits: { emphasis: 20_000 } });
  await refuses(
    core("[a][a]".repeat(5000), { scanLimits: { emphasis: 20_000 } }),
    /too many links/,
  );
});

/** @param {number} width @param {number} height */
function grayPng(width, height) {
  const crc = (/** @type {Buffer} */ bytes) => {
    let c = ~0;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ~c >>> 0;
  };
  const chunk = (/** @type {string} */ type, /** @type {Buffer} */ body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4);
    body.copy(out, 8);
    out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 0, 0, 0, 0], 8);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(Buffer.alloc((width + 1) * height), { level: 9 })),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

test("an icon PNG that declares a huge image is refused before anything is allocated; a real one is shrunk", async () => {
  const bomb = grayPng(8000, 8000);
  assert.ok(bomb.length < 70_000);
  assert.equal(await fitLinkIcon({ bytes: bomb, type: "image/png" }), null);
  const shrunk = await fitLinkIcon({ bytes: grayPng(64, 64), type: "image/png" });
  assert.deepEqual(Array.from(shrunk?.bytes.slice(16, 24) ?? []), [0, 0, 0, 32, 0, 0, 0, 32]);
});

test("an SVG icon is refused when a prefixed tag, a CSS escape or a character reference could spell what is blocked", () => {
  const svg = (/** @type {string} */ inner) =>
    new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`);
  assert.equal(linkIconType(svg('<path d="M0 0h1"/>')), "image/svg+xml");
  for (const inner of [
    "<svg:script>alert(1)</svg:script>",
    '<path style="fill:u\\72l(//x)"/>',
    '<path fill="&#106;avascript:x"/>',
  ]) {
    assert.equal(linkIconType(svg(inner)), null, inner);
  }
});

test("an icon fetch checks every redirect hop before it is requested, and never asks a private name", async () => {
  /** @type {string[]} */
  const asked = [];
  /** @type {typeof globalThis.fetch} */
  const fetch = async (input, init) => {
    const url = String(input);
    asked.push(url);
    assert.equal(init?.redirect, "manual");
    const location =
      url === "https://a.example/favicon.ico"
        ? "https://127.0.0.1.nip.io/favicon.ico"
        : "https://a.example/";
    return new Response(null, { status: 302, headers: { Location: location } });
  };
  const store = { get: async () => null, put: async () => {} };
  assert.equal(await lookupLinkIcon("a.example", { store, fetch }), null);
  assert.ok(!asked.some((url) => url.includes("nip.io")), asked.join());
  for (const host of ["x.sslip.io", "x.localtest.me", "printer.lan", "db.corp", "0x7f.1"]) {
    assert.equal(await lookupLinkIcon(host, { store, fetch }), null);
  }
  assert.ok(!asked.some((url) => /sslip|localtest|\.lan|\.corp|0x7f/.test(url)));
});

test("required text that is only whitespace counts as missing, and a silent video needs its description", async () => {
  await refuses(site(':::figure{src="/a.png" alt="  "}\ncap\n:::'), /requires an alt attribute/);
  await refuses(site(':::details{summary=" "}\nx\n:::'), /requires a summary attribute/);
  await refuses(site(':abbr[HTML]{title=" "}'), /requires a title attribute/);
  await refuses(site('::embed{url="https://youtu.be/dQw4w9WgXcQ" title=" "}'), /requires a title/);
  const video = ':::video{src="/a.mp4" title=" " captions="/a.vtt" poster="/p.png"}\n:::';
  await refuses(site(video), /requires a title attribute/);
  const silent = (/** @type {string} */ content) =>
    `:::video{src="/a.mp4" title="Clip" poster="/p.png" silent}\n${content}\n:::`;
  await refuses(site(silent("")), /is silent, so it needs a description/);
  assert.match((await site(silent("A square slides across a field."))).html, /<figcaption>/);
});

test("an author's heading never shares an id with a sidenote or the footnotes heading", async () => {
  const { html } = await site(
    '## Sn 1\n\n:::sidenote{kind="Note"}\nAside.\n:::\n\n## Footnote label\n\nText[^1].\n\n[^1]: Note.',
  );
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
  );
  assert.ok(ids.includes("sn-1") && ids.includes("footnote-label"));
  assert.ok(ids.includes("sn-1-1") && ids.includes("footnote-label-1"));
});

test("a pull quote's aria-hidden copy is not counted as words or taken as the excerpt", async () => {
  const plain = await site("A sentence here, then more words follow.");
  const raised = await site("A :pullquote[sentence here], then more words follow.");
  assert.equal(raised.words, plain.words);
  assert.equal(raised.excerpt, plain.excerpt);
});

test("every URL attribute a plugin writes is held to the protocol list, not only href and src", async () => {
  /** @type {import("../render-packs.mjs").RenderPack} */
  const hostile = {
    name: "hostile",
    directives: [],
    setup: () => ({
      remark: [],
      rehype: [
        [
          () => (/** @type {any} */ tree) => {
            const el = (/** @type {string} */ tagName, /** @type {any} */ properties) => ({
              type: "element",
              tagName,
              properties,
              children: [],
            });
            tree.children.push(
              el("form", { action: "javascript:alert(1)" }),
              el("video", { poster: "javascript:alert(2)", src: "/ok.mp4" }),
              el("img", { src: "/ok.png", srcSet: "/ok.png 1x, javascript:alert(3) 2x", alt: "" }),
              el("button", { formAction: "javascript:alert(4)" }),
              el("blockquote", { cite: "https://example.com/ok" }),
            );
          },
        ],
      ],
    }),
  };
  const result = await core("x", { packs: [hostile] });
  assert.doesNotMatch(result.html, /javascript/);
  assert.match(result.html, /cite="https:\/\/example\.com\/ok"/);
  assert.match(result.html, /src="\/ok\.mp4"/);
  assert.equal(result.blockedUrls.length, 4);
});

test("a ::bookmark whose url cannot be parsed is a ContentError", async () => {
  await refuses(
    site('::bookmark[Title]{url="https://exa mple.com/"}'),
    /::bookmark on line 1 of the body has a url that is not a valid address/,
  );
});

test("chart CSV may hold a quoted line break and begin with a byte order mark", async () => {
  const csv = '﻿name,count\r\n"Line one\r\nline two",3\r\nOther,5\r\n';
  const { html } = await core(
    `:::chart{type="bar" x="name" y="count" alt="Counts" title="Counts"}\n\`\`\`csv\n${csv}\`\`\`\n:::`,
    { packs: [editorialPack({ assetPrefix: "x-" })] },
  );
  assert.match(html, /Line one\s*line two/);
  assert.match(html, /<td>5<\/td>/);
});

test("a chart src with a .. segment, a backslash or a scheme but http(s) never reaches the loader", async () => {
  /** @type {string[]} */
  const asked = [];
  const chartData = async (/** @type {string} */ src) => {
    asked.push(src);
    return "a,b\n1,2";
  };
  const cite = (/** @type {string} */ src) =>
    core(`:::chart{type="bar" x="a" y="b" alt="x" src="${src}"}\n:::`, {
      packs: [editorialPack({ assetPrefix: "x-", chartData })],
    });
  for (const src of [
    "/media/../secret.csv",
    "/media/%2e%2e/x.csv",
    "\\\\host\\x.csv",
    "file:///etc/passwd",
  ]) {
    await refuses(cite(src), /which (has a \.\. segment|holds a backslash|uses the file: scheme)/);
  }
  await cite("https://example.com/a.csv");
  assert.deepEqual(asked, ["https://example.com/a.csv"]);
});
