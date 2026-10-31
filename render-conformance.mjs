// The conformance corpus for the markdown pipeline: hostile inputs, and the check every site runs against its own configured renderer
// (carrel/design-markdown-pipeline.md, section 5). Extended whenever a bypass is found; never shortened.
//
// The oracle is a parser, not a regex: a first regex scan of the original 44 reported 5 false positives (text such as `onerror=`
// sitting inside an escaped attribute value). A pair of counts comes back with the result, so zero violations cannot mean zero read.

import { ContentError } from "./render-error.mjs";
import { scanHtml } from "./render-safe.mjs";

/** @type {ReadonlyArray<{ name: string, source: string }>} */
export const HOSTILE_INPUTS = [
  { name: "raw script", source: "before\n\n<script>alert(1)</script>\n\nafter" },
  { name: "inline script in prose", source: "text <script>alert(1)</script> text" },
  { name: "img onerror", source: '<img src="x" onerror="alert(1)">' },
  { name: "iframe", source: '<iframe src="https://example.com"></iframe>' },
  { name: "style with url", source: '<style>body{background:url("https://example.com/x")}</style>' },
  { name: "svg onload", source: '<svg onload="alert(1)"><circle r="5"/></svg>' },
  { name: "form", source: '<form action="https://example.com"><input name="x"></form>' },
  { name: "details ontoggle", source: "<details open ontoggle=\"alert(1)\"><summary>x</summary></details>" },
  { name: "javascript link", source: "[x](javascript:alert(1))" },
  { name: "javascript link, mixed case", source: "[x](JaVaScRiPt:alert(1))" },
  { name: "javascript link, entity", source: "[x](&#106;avascript:alert(1))" },
  { name: "javascript link, percent", source: "[x](%6Aavascript:alert(1))" },
  { name: "javascript link, leading space", source: "[x](< javascript:alert(1)>)" },
  { name: "javascript link, tab", source: "[x](<java\tscript:alert(1)>)" },
  { name: "javascript link, null byte", source: "[x](<java\u0000script:alert(1)>)" },
  { name: "data link", source: "[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)" },
  { name: "vbscript link", source: "[x](vbscript:msgbox(1))" },
  { name: "file link", source: "[x](file:///etc/passwd)" },
  { name: "protocol-relative link", source: "[x](//example.com/x)" },
  { name: "javascript image", source: "![x](javascript:alert(1))" },
  { name: "data image", source: "![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+)" },
  { name: "javascript autolink", source: "<javascript:alert(1)>" },
  { name: "javascript reference link", source: "[x][a]\n\n[a]: javascript:alert(1)" },
  { name: "html in link text", source: "[<img src=x onerror=alert(1)>](https://example.com)" },
  { name: "quote break in title", source: '[x](https://example.com "a\\" onmouseover=\\"alert(1)")' },
  { name: "quote break in alt", source: '![a" onerror="alert(1)](https://example.com/x.png)' },
  { name: "katex href", source: "$\\href{javascript:alert(1)}{x}$" },
  { name: "katex url", source: "$\\url{javascript:alert(1)}$" },
  { name: "katex htmlClass", source: "$\\htmlClass{evil}{x}$" },
  { name: "katex htmlStyle", source: "$\\htmlStyle{background:url(https://example.com)}{x}$" },
  { name: "katex includegraphics", source: "$\\includegraphics{https://example.com/x.png}$" },
  { name: "unknown container directive", source: ":::evil\nx\n:::" },
  { name: "unknown text directive", source: "a :alert(1) b" },
  { name: "malformed directive", source: ":::figure{src=\"x\" onerror=\"alert(1)\"\nx\n:::" },
  { name: "directive attributes carrying markup", source: ':::details{summary="<img src=x onerror=alert(1)>"}\nbody\n:::' },
  {
    name: "chart text carrying markup",
    source:
      ':::chart{type="bar" x="label" y="value" title="<script>alert(1)</script>" alt="<img src=x onerror=alert(1)>"}\n```csv\nlabel,value\n<img src=x onerror=alert(1)>,1\n<script>alert(1)</script>,2\n```\n:::',
  },
  { name: "diagram text carrying markup", source: ':::diagram{title="<script>alert(1)</script>" alt="<img src=x onerror=alert(1)>"}\n```mermaid\ngraph TD; A-->B\n```\n:::' },
  { name: "code fence language", source: '```"><script>alert(1)</script>\ncode\n```' },
  { name: "code fence meta", source: '```js {1} onmouseover="alert(1)"\ncode\n```' },
  { name: "heading markup", source: "# <img src=x onerror=alert(1)>" },
  { name: "footnote markup", source: "x[^1]\n\n[^1]: <script>alert(1)</script>" },
  { name: "table cell markup", source: "| a |\n| - |\n| <img src=x onerror=alert(1)> |" },
  { name: "comment breakout", source: "<!-- --><script>alert(1)</script><!-- -->" },
  { name: "javascript video", source: ':::video{src="javascript:alert(1)" title="x" silent}\n:::' },
  { name: "javascript captions", source: ':::video{src="/a.mp4" title="x" captions="javascript:alert(1)"}\n:::' },
  { name: "javascript transcript", source: '::audio{src="/a.mp3" title="x" transcript="javascript:alert(1)"}' },
  { name: "embed from an unknown host", source: '::embed[x]{url="https://example.com/evil"}' },
  { name: "embed id carrying markup", source: '::embed[x]{url="https://youtu.be/\\"><script>alert(1)</script>"}' },
  { name: "javascript button", source: '::button[x]{href="javascript:alert(1)"}' },
  { name: "javascript bookmark", source: '::bookmark[x]{url="javascript:alert(1)"}' },
  { name: "callout title carrying markup", source: "> [!NOTE] <img src=x onerror=alert(1)>\n> body" },
  { name: "abbr title carrying markup", source: ':abbr[x]{title="\\" onmouseover=\\"alert(1)"}' },
  { name: "code title carrying markup", source: '```js title="<script>alert(1)</script>"\ncode\n```' },
  { name: "long bracket run", source: "[".repeat(20000) },
];

/**
 * Renders every hostile input with the caller's own configured renderer and scans what comes out.
 *
 * @param {(source: string) => Promise<{ html: string }>} renderSource the site's renderer, configured as the site configures it
 * @param {import("./render-safe.mjs").Allowlist} [allowlist]
 * @returns {Promise<{
 *   inputs: number,
 *   rendered: number,
 *   refused: string[],
 *   elements: number,
 *   attributes: number,
 *   violations: Array<{ input: string, kind: string, tag: string, attribute?: string }>,
 * }>}
 */
export async function runConformance(renderSource, allowlist) {
  let rendered = 0;
  let elements = 0;
  let attributes = 0;
  /** @type {string[]} */
  const refused = [];
  /** @type {Array<{ input: string, kind: string, tag: string, attribute?: string }>} */
  const violations = [];

  for (const { name, source } of HOSTILE_INPUTS) {
    let html;
    try {
      ({ html } = await renderSource(source));
    } catch (error) {
      // A refusal (ContentError) is a safe outcome: nothing was produced. Anything else is a crash, which must not pass as a refusal.
      if (!(error instanceof ContentError)) throw error;
      refused.push(name);
      continue;
    }
    rendered += 1;
    const scan = scanHtml(html, allowlist);
    elements += scan.elements;
    attributes += scan.attributes;
    for (const violation of scan.violations) violations.push({ input: name, ...violation });
  }

  return { inputs: HOSTILE_INPUTS.length, rendered, refused, elements, attributes, violations };
}
