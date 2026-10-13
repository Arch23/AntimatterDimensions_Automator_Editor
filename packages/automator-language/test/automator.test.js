"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  validate,
  completionItems,
  MAX_SCRIPT_CHARACTERS,
  scriptCharacterCount,
  formatScript,
  FormattingError,
  tokenizeAutomatorLine
} = require("../src");
const { expandScript, SnippetError } = require("../src/node-snippets");

test("shared highlighting separates command words from modifiers, including indentation", () => {
  const typesFor = line => tokenizeAutomatorLine(line).map(token => [line.slice(token.start, token.end), token.type]);
  assert.deepEqual(typesFor("    studies nowait load name ACTV"), [
    ["studies", "command"], ["nowait", "modifier"], ["load", "subcommand"]
  ]);
  assert.deepEqual(typesFor("  studies respec"), [
    ["studies", "command"], ["respec", "modifier"]
  ]);
  assert.deepEqual(typesFor("  eternity nowait respec"), [
    ["eternity", "command"], ["nowait", "modifier"], ["respec", "modifier"]
  ]);
});

test("shared highlighting keeps keywords inside strings and comments unclassified", () => {
  const line = '  notify "studies nowait"';
  const tokens = tokenizeAutomatorLine(line);
  assert.deepEqual(tokens.map(token => [line.slice(token.start, token.end), token.type]), [
    ["notify", "command"], ['"studies nowait"', "string"]
  ]);
  const comment = "  // studies respec";
  assert.deepEqual(tokenizeAutomatorLine(comment).map(token => [
    comment.slice(token.start, token.end), token.type
  ]), [["// studies respec", "comment"]]);
});

test("snippet references are highlighted only when the extension opts in", () => {
  assert.equal(tokenizeAutomatorLine("{climb_ep}").some(token => token.type === "snippet"), false);
  assert.equal(tokenizeAutomatorLine("{climb_ep}", { includeSnippets: true })
    .some(token => token.type === "snippet"), true);
});

test("shared highlighting tokenizes representative Automator examples consistently", () => {
  const examplesDirectory = path.resolve(__dirname, "../../../extensions/vscode-extension/Examples");
  const fixtures = fs.readdirSync(examplesDirectory).filter(filename => filename.endsWith(".aut"));
  assert.ok(fixtures.length > 0, "Expected representative .aut fixtures");
  for (const fixture of fixtures) {
    const source = fs.readFileSync(path.join(examplesDirectory, fixture), "utf8");
    for (const line of source.split(/\r?\n/)) {
      const tokens = tokenizeAutomatorLine(line);
      let previousEnd = 0;
      for (const token of tokens) {
        assert.ok(token.start >= previousEnd, `${fixture}: overlapping tokens in '${line}'`);
        assert.ok(token.end > token.start && token.end <= line.length, `${fixture}: invalid token range in '${line}'`);
        previousEnd = token.end;
      }
    }
  }
});

test("accepts valid commands and nested blocks", () => {
  const script = [
    "# a note",
    "studies nowait purchase 11-62, idle",
    "if ep > 1e500 {",
    "  wait black hole bh1",
    "  until reality {",
    "    pause 10 seconds",
    "  }",
    "}"
  ].join("\n");

  assert.deepEqual(validate(script), []);
});

test("accepts the documented command forms and numeric formats", () => {
  const script = [
    "studies load name ANTI",
    "studies nowait purchase ec6Studies",
    "infinity nowait",
    "eternity respec",
    "unlock ec7",
    "start dilation",
    "auto infinity 30s",
    "auto eternity 1e100 x highest",
    "auto reality 1e100 rm",
    "black hole off",
    'notify "Dilation reached"',
    "wait pending completions >= 5",
    "pause 34 seconds"
  ].join("\n");

  assert.deepEqual(validate(script), []);
});

test("accepts game template Eternity Challenge syntax with a spaced number", () => {
  assert.deepEqual(validate("start ec 11\nunlock nowait ec 7"), []);
});

test("accepts exported Time Study choice IDs with nowait", () => {
  const script = "studies nowait purchase 11,22,32,42,51,61,71,81,91,101,111,121,131,141,151,162,161,171|0";

  assert.deepEqual(validate(script), []);
});

test("does not lint extension snippet reference tokens as native commands", () => {
  assert.deepEqual(validate("stop\n{restore-clean-game}\nstop"), []);
});

test("reports malformed commands and unsupported equality comparisons", () => {
  const diagnostics = validate([
    "black hole maybe",
    "wait ep == 100",
    "notacommand"
  ].join("\n"));

  assert.equal(diagnostics.length, 3);
  assert.match(diagnostics[0].message, /black hole on/);
  assert.match(diagnostics[1].message, /equality operators/);
  assert.match(diagnostics[2].message, /Unknown Automator command/);
});

test("reports missing and unmatched braces", () => {
  const diagnostics = validate("if ep > 10 {\nstop\n}");
  assert.deepEqual(diagnostics, []);
  assert.match(validate("while ep < 10 {\nstop")[0].message, /missing a closing/);
  assert.match(validate("}")[0].message, /Unexpected closing/);
});

test("enforces the 10,000-character per-script limit", () => {
  assert.deepEqual(validate(`#${"x".repeat(MAX_SCRIPT_CHARACTERS - 2)}`), []);
  const diagnostics = validate(`#${"x".repeat(MAX_SCRIPT_CHARACTERS - 1)}`);
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0].message, /cannot exceed 10,000 characters/);
  assert.equal(diagnostics[0].line, 0);
  assert.equal(diagnostics[0].start, MAX_SCRIPT_CHARACTERS);
  assert.equal(diagnostics[0].end, MAX_SCRIPT_CHARACTERS);
});

test("counts script characters with normalized line endings and omitted blank lines", () => {
  assert.equal(scriptCharacterCount("one\r\ntwo\r\n\r\n"), 8);
  assert.equal(scriptCharacterCount("one\ntwo\n\n"), 8);
  assert.equal(scriptCharacterCount("  stop  \n\n"), 9);
});

test("formats block indentation while preserving line content and line endings", () => {
  const source = '\tif ep > 1 {\r\n\tstop  \r\n\r\n\tif am > 2 {\r\n\t\t// note  \r\n\t\tnotify "keep  spaces"\r\n\t}\r\n}\r\n';
  const expected = 'if ep > 1 {\r\n  stop  \r\n\r\n  if am > 2 {\r\n    // note  \r\n    notify "keep  spaces"\r\n  }\r\n}\r\n';

  assert.equal(formatScript(source), expected);
  assert.equal(formatScript(expected), expected);
});

test("refuses to format malformed or unsupported block structure", () => {
  for (const source of [
    "if ep > 1 {\n  stop\n",
    "if invalid {\n}\n",
    "if ep > 1\n}",
    "}"
  ]) {
    assert.throws(() => formatScript(source), FormattingError);
  }
});

test("expands snippet and snpt files from the adjacent ext folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automator-snippets-"));
  try {
    const ext = path.join(root, "ext");
    fs.mkdirSync(ext);
    fs.writeFileSync(path.join(ext, "restore.snippet"), "auto infinity off\n{wait-ready}");
    fs.writeFileSync(path.join(ext, "wait-ready.snpt"), "wait ep >= 1e100");
    const scriptPath = path.join(root, "main.aut");
    const result = expandScript("# setup\n{restore}\nstop", scriptPath);

    assert.equal(result.content, "# setup\nauto infinity off\nwait ep >= 1e100\nstop");
    assert.deepEqual(result.snippets, ["restore", "wait-ready"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("uses open unsaved snippet text when expanding", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automator-open-snippet-"));
  try {
    const ext = path.join(root, "ext");
    fs.mkdirSync(ext);
    const snippetPath = path.join(ext, "part.snippet");
    fs.writeFileSync(snippetPath, "saved version");
    const result = expandScript("{part}", path.join(root, "main.automator"), filePath =>
      filePath === snippetPath ? "unsaved version" : undefined
    );
    assert.equal(result.content, "unsaved version");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reports missing snippets and recursive snippet cycles", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "automator-snippet-errors-"));
  try {
    const ext = path.join(root, "ext");
    fs.mkdirSync(ext);
    const scriptPath = path.join(root, "main.automator");

    assert.throws(
      () => expandScript("{missing}", scriptPath),
      error => error instanceof SnippetError && /not found/.test(error.message)
    );

    fs.writeFileSync(path.join(ext, "first.snippet"), "{second}");
    fs.writeFileSync(path.join(ext, "second.snpt"), "{first}");
    assert.throws(
      () => expandScript("{first}", scriptPath),
      error => error instanceof SnippetError && /cycle detected/.test(error.message)
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("offers command and context-specific completions", () => {
  assert.ok(completionItems("").some(item => item.label === "studies respec"));
  assert.ok(completionItems("auto").some(item => item.label === "infinity"));
  assert.ok(completionItems("black hole").some(item => item.label === "bh1") === false);
  assert.ok(completionItems("wait black hole").some(item => item.label === "bh1"));
});

test("suggests nowait while typing its prefix", () => {
  for (const prefix of ["studies no", "eternity no", "infinity n", "unlock no"]) {
    const item = completionItems(prefix).find(suggestion => suggestion.label === "nowait");
    assert.ok(item, `Expected nowait completion for '${prefix}'`);
    assert.equal(prefix.slice(item.replaceFrom), prefix.split(/\s+/).at(-1));
  }
});

test("suggests x highest after variable Infinity and Eternity Autobuyer amounts", () => {
  for (const prefix of ["auto eternity 1e5", "auto infinity 42 ", "auto eternity 1e5 x"]) {
    const item = completionItems(prefix).find(suggestion =>
      suggestion.label === "x highest" || suggestion.label === "highest"
    );
    assert.ok(item, `Expected x highest completion for '${prefix}'`);
    if (prefix.endsWith("x")) {
      assert.equal(item.insertText, "highest");
      assert.equal(prefix.slice(item.replaceFrom), "x");
      assert.equal(item.filterText, "x highest");
    } else {
      assert.match(item.insertText, /x highest$/);
      assert.equal(item.replaceFrom, prefix.length);
    }
  }
});
