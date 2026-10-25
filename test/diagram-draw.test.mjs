import assert from "node:assert/strict";
import test from "node:test";

import { auditDiagramSvg } from "../render-diagram-draw.mjs";

const PALETTE = ["#111111", "#EEEEEE"];
const problems = (/** @type {string} */ svg) => auditDiagramSvg(svg, PALETTE).problems;

test("the colour audit reaches the root's own style, @media and @keyframes rules, and defs a <use> names", () => {
  assert.match(problems('<svg style="background-color: #FF0000"><rect fill="#111111"/></svg>').join(), /<svg style> background-color: #FF0000/);
  assert.equal(problems("<svg><style>@media (prefers-color-scheme: dark) { rect { fill: #FF0000; } }</style><rect/></svg>").length, 1);
  assert.equal(problems("<svg><style>@keyframes pulse { from { fill: #FF0000; } }</style><rect/></svg>").length, 1);
  assert.equal(problems('<svg><defs><g id="box"><rect fill="#FF0000"/></g></defs><use href="#box"/></svg>').length, 1);
  assert.equal(problems('<svg><defs><g id="unused"><rect fill="#FF0000"/></g></defs><rect fill="#111111"/></svg>').length, 0);
});

test("unbalanced braces throw rather than dropping the rules after them", () => {
  assert.throws(() => problems("<svg><style>a { fill: red; } } b { fill: blue; }</style></svg>"), /closes nothing/);
  assert.throws(() => problems("<svg><style>a { fill: red;</style></svg>"), /never closed/);
});
