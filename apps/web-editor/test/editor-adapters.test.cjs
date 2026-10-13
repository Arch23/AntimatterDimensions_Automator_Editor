"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { completionItems, validate } = require("../../../packages/automator-language/src");
const { completionFilterText, completionStart, diagnosticRange } = require("../src/editor-adapters.cjs");

test("web completion mapping replaces the matching word within multiword labels", () => {
  const items = completionItems("wait in");
  const matching = items
    .map(item => ({ item, filterText: completionFilterText(item, "in") }))
    .filter(({ filterText }) => filterText?.startsWith("in"));

  assert.ok(matching.some(({ item, filterText }) => item.label === "infinities" && filterText === "infinities"));
  assert.ok(matching.some(({ item, filterText }) => item.label === "banked infinities" && filterText === "infinities"));
  assert.equal(completionStart("wait in", 12, matching[0].item), 17);
});

test("web completion mapping respects shared explicit replacement hints", () => {
  const nowait = completionItems("studies no").find(item => item.label === "nowait");
  assert.ok(nowait);
  assert.equal(completionStart("studies no", 0, nowait), nowait.replaceFrom);
  assert.equal(completionStart("  stu", 100, { label: "studies", detail: "", insertText: "studies", replaceLine: true }), 102);
});

test("web diagnostic mapping clamps shared validator ranges to the CodeMirror line", () => {
  const source = "stop\nblack hole maybe";
  const diagnostic = validate(source)[0];
  assert.ok(diagnostic);
  assert.deepEqual(diagnosticRange({ from: 5, length: 8 }, diagnostic), { from: 5, to: 13 });
});
