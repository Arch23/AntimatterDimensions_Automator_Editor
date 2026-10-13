"use strict";

const currencies = [
  "pending glyph level", "pending ip", "pending ep", "pending tp", "pending rm",
  "pending completions", "banked infinities", "total tt", "total completions", "spent tt",
  "infinities", "eternities", "realities", "completions", "am", "ip", "ep", "rm", "dt",
  "tp", "rg", "rep", "tt"
];
const constants = [
  "dilation", "on", "off", "bh1", "bh2", "highest", "antimatter", "active", "passive",
  "idle", "light", "dark", "time"
];
const commands = ["infinity", "eternity", "reality", "unlock", "start", "auto", "notify", "wait", "pause", "stop"];
const word = /^[a-z][a-z0-9_]*/i;
const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i;
const comparison = /^(?:<=|>=|<|>)/;

function matchPhrase(source, phrases) {
  for (const phrase of phrases) {
    const expression = new RegExp(`^${phrase.replaceAll(" ", "\\s+")}\\b`, "i");
    const match = source.match(expression);
    if (match) return match[0];
  }
  return null;
}

function push(tokens, start, end, type) {
  tokens.push({ start, end, type });
}

/**
 * Token categories shared by the VS Code and browser editor adapters.
 * Returns only styled spans; all offsets are UTF-16 columns, as required by VS Code.
 */
function tokenizeAutomatorLine(line, options = {}) {
  const tokens = [];
  const includeSnippets = options.includeSnippets === true;
  let index = 0;
  let firstWord = true;
  let studiesCommand = false;
  let pendingStudiesPart = false;
  let afterControl = false;

  while (index < line.length) {
    const rest = line.slice(index);
    if (/\s/.test(line[index])) { index++; continue; }
    if (firstWord && /^(?:#|\/\/)/.test(rest)) {
      push(tokens, index, line.length, "comment");
      break;
    }
    if (line[index] === '"') {
      let end = index + 1;
      let escaped = false;
      while (end < line.length) {
        const character = line[end++];
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') break;
      }
      push(tokens, index, end, "string");
      index = end;
      firstWord = false;
      continue;
    }
    if (includeSnippets) {
      const snippet = rest.match(/^\{[a-z0-9_-]+\}/i);
      if (snippet) {
        push(tokens, index, index + snippet[0].length, "snippet");
        index += snippet[0].length;
        firstWord = false;
        continue;
      }
    }
    const control = firstWord && rest.match(/^(if|until|while)\b/i);
    if (control) {
      push(tokens, index, index + control[0].length, "control");
      index += control[0].length;
      firstWord = false;
      afterControl = true;
      continue;
    }
    if (firstWord && /^studies\b/i.test(rest)) {
      push(tokens, index, index + 7, "command");
      index += 7;
      firstWord = false;
      studiesCommand = true;
      pendingStudiesPart = true;
      continue;
    }
    if (firstWord && /^black\s+hole\b/i.test(rest)) {
      const matched = rest.match(/^black\s+hole\b/i)[0];
      push(tokens, index, index + matched.length, "command");
      index += matched.length;
      firstWord = false;
      continue;
    }
    if (firstWord) {
      const command = rest.match(new RegExp(`^(?:${commands.join("|")})\\b`, "i"));
      if (command) {
        push(tokens, index, index + command[0].length, "command");
        index += command[0].length;
        firstWord = false;
        continue;
      }
    }
    const currentWord = rest.match(word);
    if (currentWord) {
      const value = currentWord[0];
      const lower = value.toLowerCase();
      let type = null;
      if (lower === "nowait" || lower === "respec") type = "modifier";
      else if (studiesCommand && pendingStudiesPart && ["load", "purchase"].includes(lower)) type = "subcommand";
      else if (studiesCommand && pendingStudiesPart && lower === "respec") type = "modifier";
      else if (afterControl && ["infinity", "eternity", "reality"].includes(lower)) type = "command";
      else if (matchPhrase(rest, currencies)) type = "currency";
      else if (/^ec(?:[1-9]|1[0-2])$/i.test(value) && /^\s+completions\b/i.test(line.slice(index + value.length))) {
        const phrase = rest.match(/^ec(?:[1-9]|1[0-2])\s+completions\b/i)[0];
        type = "currency";
        push(tokens, index, index + phrase.length, type);
        index += phrase.length;
        firstWord = false;
        pendingStudiesPart = false;
        afterControl = false;
        continue;
      } else if (matchPhrase(rest, constants)) type = "constant";
      if (type) push(tokens, index, index + value.length, type);
      index += value.length;
      firstWord = false;
      if (studiesCommand && pendingStudiesPart && ["load", "purchase", "respec"].includes(lower)) pendingStudiesPart = false;
      afterControl = false;
      continue;
    }
    const numeric = rest.match(number);
    if (numeric) {
      const range = rest.match(/^\d+\s*-\s*\d+\b/);
      push(tokens, index, index + (range?.[0].length ?? numeric[0].length), range ? "range" : "number");
      index += range?.[0].length ?? numeric[0].length;
      firstWord = false;
      afterControl = false;
      continue;
    }
    const operator = rest.match(comparison);
    if (operator) {
      push(tokens, index, index + operator[0].length, "operator");
      index += operator[0].length;
      firstWord = false;
      afterControl = false;
      continue;
    }
    if (line[index] === "{" || line[index] === "}") push(tokens, index, index + 1, "punctuation");
    index++;
    firstWord = false;
    afterControl = false;
  }
  return tokens;
}

module.exports = { tokenizeAutomatorLine };
