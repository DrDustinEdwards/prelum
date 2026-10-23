// Its own file, so its process has loaded no wasm yet: shiki keeps the first load for the isolate, and the failure has to be the first.

import assert from "node:assert/strict";
import test from "node:test";

import { render } from "../render.mjs";
import { createHighlight } from "../render-highlight.mjs";
import { resolveImage } from "./render-config.mjs";

test("a failed wasm load fails only its own render; the next one loads it again", async () => {
  let calls = 0;
  const highlight = createHighlight({
    wasm: () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("planted wasm load failure")) : import("shiki/wasm");
    },
  });
  const body = "```js\nconst x = 1;\n```\n";
  const once = () => render({ file: "post.md", body, resolveImage, options: { highlight } });

  await assert.rejects(once(), /planted wasm load failure/);
  assert.match((await once()).html, /<pre class="shiki/);
  assert.equal(calls, 2);
});
