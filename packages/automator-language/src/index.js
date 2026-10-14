"use strict";

const { tokenizeAutomatorLine } = require("./highlighting");

const commandNames = [
  "studies respec",
  "studies load",
  "studies purchase",
  "infinity",
  "eternity",
  "reality",
  "unlock",
  "start",
  "auto",
  "black hole",
  "notify",
  "wait",
  "pause",
  "if",
  "until",
  "while",
  "stop"
];

const currencies = [
  "am",
  "ip",
  "ep",
  "rm",
  "infinities",
  "banked infinities",
  "eternities",
  "realities",
  "pending ip",
  "pending ep",
  "pending tp",
  "pending rm",
  "pending glyph level",
  "dt",
  "tp",
  "rg",
  "rep",
  "tt",
  "total tt",
  "spent tt",
  "total completions",
  "pending completions"
];

const studyAliases = [
  "antimatter",
  "infinity",
  "time",
  "active",
  "passive",
  "idle",
  "light",
  "dark"
];

const numberPattern = "(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
const numberRegex = new RegExp(`^${numberPattern}$`, "i");
const variableRegex = /^[a-z_][a-z0-9_]*$/i;
const MAX_SCRIPT_CHARACTERS = 10000;

function scriptCharacterCount(source) {
  const lines = source
    .split(/\r\n|\r|\n/)
    .filter(line => line.length > 0);
  return lines.reduce((count, line) => count + line.length, 0) + Math.max(0, lines.length - 1);
}

class FormattingError extends Error {
  constructor(message) {
    super(message);
    this.name = "FormattingError";
  }
}

// The formatter intentionally changes leading indentation only. Refuse to edit
// text if braces do not form the documented block structure.
function formatScript(source, indentSize = 2) {
  if (!Number.isInteger(indentSize) || indentSize < 0) {
    throw new RangeError("Indent size must be a non-negative integer.");
  }

  const segments = source.split(/(\r\n|\r|\n)/);
  const blocks = [];
  let depth = 0;

  for (let index = 0; index < segments.length; index += 2) {
    const line = segments[index];
    const trimmed = line.trim();
    const content = line.trimStart();
    if (!trimmed) continue;
    if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
      segments[index] = `${" ".repeat(depth * indentSize)}${content}`;
      continue;
    }
    if (/^(if|while|until)\b/i.test(trimmed) && !trimmed.endsWith("{")) {
      throw new FormattingError("Formatting was skipped because a block header is missing its opening brace.");
    }
    // Snippet references are ordinary source text in the web release.
    if (/^\{[a-zA-Z0-9_-]+\}$/.test(trimmed)) {
      segments[index] = `${" ".repeat(depth * indentSize)}${content}`;
      continue;
    }

    const structuralBraces = [];
    let inString = false;
    let escaped = false;
    for (let column = 0; column < line.length; column++) {
      const character = line[column];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') {
        inString = true;
      } else if (character === "{" || character === "}") {
        structuralBraces.push({ character, column });
      }
    }
    if (inString) {
      throw new FormattingError("Formatting was skipped because a quoted string is not closed on its line.");
    }

    let opensBlock = false;
    if (trimmed === "}") {
      if (structuralBraces.length !== 1 || structuralBraces[0].character !== "}" || blocks.length === 0) {
        throw new FormattingError("Formatting was skipped because the block braces are unbalanced or malformed.");
      }
      blocks.pop();
      depth--;
    } else if (structuralBraces.length > 0) {
      if (structuralBraces.length !== 1 || structuralBraces[0].character !== "{" ||
        structuralBraces[0].column !== line.lastIndexOf("{") || trimmed.at(-1) !== "{") {
        throw new FormattingError("Formatting was skipped because a brace is not part of a supported block header.");
      }
      const header = trimmed.slice(0, -1).trimEnd();
      if (!isValidBlockHeader(header)) {
        throw new FormattingError("Formatting was skipped because a block header is not recognized.");
      }
      opensBlock = true;
    }

    segments[index] = `${" ".repeat(depth * indentSize)}${content}`;
    if (opensBlock) {
      blocks.push(index);
      depth++;
    }
  }

  if (blocks.length > 0) {
    throw new FormattingError("Formatting was skipped because a block is missing its closing brace.");
  }
  return segments.join("");
}

function normalize(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isValue(value) {
  const normalized = normalize(value);
  return currencies.includes(normalized) ||
    /^ec(?:[1-9]|1[0-2]) completions$/i.test(normalized) ||
    numberRegex.test(normalized) ||
    variableRegex.test(normalized);
}

function isComparison(value) {
  const operators = [...value.matchAll(/<=|>=|<|>/g)];
  if (operators.length !== 1) return false;
  const operator = operators[0];
  const left = value.slice(0, operator.index);
  const right = value.slice(operator.index + operator[0].length);
  return isValue(left) && isValue(right);
}

function isPrestige(value) {
  return /^(infinity|eternity|reality)$/i.test(value.trim());
}

function addDiagnostic(diagnostics, line, start, end, message, severity = "error") {
  diagnostics.push({
    line,
    start: Math.max(0, start),
    end: Math.max(start + 1, end),
    message,
    severity
  });
}

function validateCommand(text, line, diagnostics, opensBlock) {
  const fail = (message) => addDiagnostic(diagnostics, line, 0, text.length, message);

  if (/^studies\s+respec$/i.test(text)) return;

  let match = text.match(/^studies\s+(?:nowait\s+)?load\s+(id\s+([1-6])|name\s+(.+))$/i);
  if (match) {
    if (match[3] && !match[3].trim()) {
      fail("A preset name is required after 'load name'.");
    }
    return;
  }
  if (/^studies\s+(?:nowait\s+)?load\b/i.test(text)) {
    fail("Expected 'studies load id 1-6' or 'studies load name <name>'.");
    return;
  }

  match = text.match(/^studies\s+(?:nowait\s+)?purchase\s+(.+)$/i);
  if (match) {
    const list = match[1].trim();
    if (variableRegex.test(list)) return;
    const items = list.split(",").map(item => item.trim().toLowerCase());
    if (items.length > 0 && items.every(item =>
      studyAliases.includes(item) ||
      /^\d+(?:\|\d+)?$/.test(item) ||
      /^\d+\s*-\s*\d+$/.test(item)
    )) return;
    fail("Expected a Time Study list (IDs, exported choice IDs, ranges, aliases, or a variable name).");
    return;
  }
  if (/^studies\s+(?:nowait\s+)?purchase\b/i.test(text)) {
    fail("A Time Study list is required after 'purchase'.");
    return;
  }

  if (/^(infinity|eternity|reality)(?:\s+nowait)?(?:\s+respec)?$/i.test(text)) {
    if (/^infinity\b/i.test(text) && /\brespec\b/i.test(text)) {
      fail("'respec' is only valid with eternity or reality.");
    }
    return;
  }
  if (/^(infinity|eternity|reality)\b/i.test(text)) {
    fail("Prestige syntax is '<infinity|eternity|reality> [nowait] [respec]'.");
    return;
  }

  if (/^unlock\s+(?:nowait\s+)?(?:dilation|ec\s*(?:[1-9]|1[0-2]))$/i.test(text)) return;
  if (/^unlock\b/i.test(text)) {
    fail("Expected 'unlock [nowait] dilation' or an Eternity Challenge from ec1 to ec12.");
    return;
  }

  if (/^start\s+(?:dilation|ec\s*(?:[1-9]|1[0-2]))$/i.test(text)) return;
  if (/^start\b/i.test(text)) {
    fail("Expected 'start dilation' or an Eternity Challenge from ec1 to ec12.");
    return;
  }

  match = text.match(/^auto\s+(infinity|eternity|reality)(?:\s+(.+))?$/i);
  if (match) {
    const type = match[1].toLowerCase();
    const setting = (match[2] || "").trim();
    if (!setting || /^(on|off)$/i.test(setting)) return;
    if (type !== "reality" &&
      new RegExp(`^${numberPattern}\\s*(?:ms|s|sec|seconds|m|min|minutes|h|hours)$`, "i").test(setting)) return;
    if (type !== "reality" &&
      new RegExp(`^${numberPattern}\\s+x\\s+highest$`, "i").test(setting)) return;
    const expectedCurrency = type === "infinity" ? "ip" : type === "eternity" ? "ep" : "rm";
    if (new RegExp(`^${numberPattern}\\s+${expectedCurrency}$`, "i").test(setting)) return;
    fail(`Invalid ${type} autobuyer setting. Use on/off, a supported interval or multiplier, or a ${expectedCurrency.toUpperCase()} amount.`);
    return;
  }
  if (/^auto\b/i.test(text)) {
    fail("Expected 'auto infinity', 'auto eternity', or 'auto reality', optionally followed by a setting.");
    return;
  }

  if (/^black\s+hole\s+(on|off)$/i.test(text)) return;
  if (/^black\s+hole\b/i.test(text)) {
    fail("Expected 'black hole on' or 'black hole off'.");
    return;
  }

  if (/^notify\s+"(?:[^"\\]|\\.)*"$/i.test(text)) return;
  if (/^notify\b/i.test(text)) {
    fail("Expected notification text in double quotes.");
    return;
  }

  if (/^wait\s+black\s+hole\s+(off|bh1|bh2)$/i.test(text)) return;
  if (/^wait\s+(infinity|eternity|reality)$/i.test(text)) return;
  if (/^wait\s+/i.test(text)) {
    const condition = text.replace(/^wait\s+/i, "");
    if (isComparison(condition)) return;
    if (/(?:==|!=)/.test(condition)) {
      fail("Automator comparisons support <, <=, >, and >=; equality operators are not supported.");
    } else {
      fail("Expected a comparison, prestige event, or 'black hole off|bh1|bh2' after 'wait'.");
    }
    return;
  }

  if (/^pause\s+.+$/i.test(text)) {
    const interval = text.replace(/^pause\s+/i, "").trim();
    if (variableRegex.test(interval) ||
      new RegExp(`^${numberPattern}\\s*(?:ms|s|sec|seconds|m|min|minutes|h|hours)$`, "i").test(interval)) return;
    fail("Expected a duration with a time unit (such as '10s' or '1 minute') or a constant name.");
    return;
  }
  if (/^pause\b/i.test(text)) {
    fail("A duration is required after 'pause'.");
    return;
  }

  if (/^(if|while|until)\b/i.test(text)) {
    const keyword = text.match(/^(if|while|until)\b/i)[1].toLowerCase();
    const condition = text.replace(/^(if|while|until)\s+/i, "").replace(/\s*\{$/, "").trim();
    const valid = keyword === "until" && isPrestige(condition) || isComparison(condition);
    if (!valid) {
      if (/(?:==|!=)/.test(condition)) {
        fail("Automator comparisons support <, <=, >, and >=; equality operators are not supported.");
      } else {
        fail(`Expected a valid ${keyword} comparison${keyword === "until" ? " or prestige event" : ""}.`);
      }
      return;
    }
    if (!opensBlock) {
      fail(`'${keyword}' starts a block and must end with '{'.`);
    }
    return;
  }

  if (/^stop$/i.test(text)) return;

  addDiagnostic(diagnostics, line, 0, Math.max(1, text.match(/^\S+/)[0].length), "Unknown Automator command.");
}

function validate(source) {
  const diagnostics = [];
  const blocks = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((originalLine, lineNumber) => {
    const trimmed = originalLine.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;
    if (/^\{[a-zA-Z0-9_-]+\}$/.test(trimmed)) return;
    if (trimmed.startsWith("}")) {
      if (trimmed !== "}") {
        addDiagnostic(diagnostics, lineNumber, originalLine.indexOf("}"), originalLine.length,
          "A closing brace must be on its own line.");
      }
      if (blocks.length === 0) {
        addDiagnostic(diagnostics, lineNumber, originalLine.indexOf("}"), originalLine.indexOf("}") + 1,
          "Unexpected closing brace.");
      } else {
        blocks.pop();
      }
      return;
    }

    const opensBlock = trimmed.endsWith("{");
    let command = opensBlock ? trimmed.slice(0, -1).trimEnd() : trimmed;
    validateCommand(command, lineNumber, diagnostics, opensBlock);

    if (opensBlock && isValidBlockHeader(command)) {
      blocks.push(lineNumber);
    }
  });

  for (const lineNumber of blocks) {
    const line = lines[lineNumber];
    addDiagnostic(diagnostics, lineNumber, Math.max(0, line.lastIndexOf("{")), line.length,
      "This block is missing a closing '}'.");
  }

  const characterCount = scriptCharacterCount(source);
  if (characterCount > MAX_SCRIPT_CHARACTERS) {
    const finalLine = lines.length - 1;
    const finalColumn = lines[finalLine].length;
    diagnostics.push({
      line: finalLine,
      start: finalColumn,
      end: finalColumn,
      message: `Automator scripts cannot exceed ${MAX_SCRIPT_CHARACTERS.toLocaleString("en-US")} characters (currently ${characterCount.toLocaleString("en-US")}).`,
      severity: "error"
    });
  }

  return diagnostics;
}

function isValidBlockHeader(command) {
  const match = command.match(/^(if|while|until)\s+(.+)$/i);
  if (!match) return false;
  const keyword = match[1].toLowerCase();
  const condition = match[2].trim();
  return keyword === "until" && isPrestige(condition) || isComparison(condition);
}

function completionItems(linePrefix) {
  const prefix = normalize(linePrefix);
  const suggestions = [];
  const currentWord = linePrefix.match(/\S+$/);
  const currentWordStart = currentWord ? linePrefix.length - currentWord[0].length : linePrefix.length;
  const add = (label, detail, insertText = label, options = {}) =>
    suggestions.push({ label, detail, insertText, ...options });

  if (!prefix || !/\S/.test(prefix)) {
    for (const command of commandNames) {
      add(command, "Automator command", command, { replaceLine: true });
    }
    return suggestions;
  }

  if (/^studies\s+n(?:o\w*)?$/.test(prefix) && prefix !== "studies nowait") {
    add("nowait", "Continue after purchasing as many studies as possible", "nowait", {
      replaceFrom: currentWordStart
    });
  } else if (/^(?:infinity|eternity|reality)\s+n(?:o\w*)?$/.test(prefix) && !/\s+nowait$/.test(prefix)) {
    add("nowait", "Continue if the prestige is not possible", "nowait", {
      replaceFrom: currentWordStart
    });
  } else if (/^unlock\s+n(?:o\w*)?$/.test(prefix) && !/\s+nowait$/.test(prefix)) {
    add("nowait", "Continue if unlocking fails", "nowait", {
      replaceFrom: currentWordStart
    });
  } else if (/^studies(?:\s+nowait)?$/.test(prefix)) {
    if (prefix === "studies") add("nowait", "Time Studies modifier");
    ["respec", "load", "purchase"].forEach(value => add(value, "Time Studies command"));
  } else if (/^studies\s+(?:nowait\s+)?load(?:\s+\w*)?$/.test(prefix)) {
    add("id", "Load a preset by slot");
    add("name", "Load a preset by name");
  } else if (/^studies\s+(?:nowait\s+)?purchase\b/.test(prefix)) {
    [...studyAliases, "11-62", "11,21,31"].forEach(value => add(value, "Time Study list or alias"));
  } else if (/^auto$/.test(prefix)) {
    ["infinity", "eternity", "reality"].forEach(value => add(value, "Autobuyer"));
  } else if (/^auto\s+(infinity|eternity|reality)(?:\s+(.+))?$/.test(prefix)) {
    const [, type, rawSetting = ""] = prefix.match(/^auto\s+(infinity|eternity|reality)(?:\s+(.+))?$/);
    const setting = rawSetting.trim();
    if (!setting || /^(?:o|on|of|off)$/.test(setting)) {
      ["on", "off"].forEach(value => add(value, "Autobuyer setting", value, {
        ...(setting ? { replaceFrom: currentWordStart } : {})
      }));
    }
    if (!setting) {
      ["30s", "10 seconds"].forEach(value => add(value, "Autobuyer interval"));
    }
    const numberOrMultiplier = setting.match(new RegExp(`^(${numberPattern})(?:\\s+(x))?$`, "i"));
    if (type !== "reality" && numberOrMultiplier && !numberOrMultiplier[2]) {
      const insertion = /\s$/.test(linePrefix) ? "x highest" : " x highest";
      add("x highest", "Trigger at this multiple of the highest amount", insertion, {
        replaceFrom: linePrefix.length
      });
    } else if (type !== "reality" && numberOrMultiplier && numberOrMultiplier[2]) {
      add("highest", "Complete the 'x highest' Autobuyer setting", "highest", {
        replaceFrom: currentWordStart,
        filterText: "x highest"
      });
    }
    if (numberRegex.test(setting)) {
      if (type === "infinity") add("IP", "Infinity Point threshold", " ip", { replaceFrom: linePrefix.length });
      if (type === "eternity") add("EP", "Eternity Point threshold", " ep", { replaceFrom: linePrefix.length });
      if (type === "reality") add("RM", "Reality Machine threshold", " rm", { replaceFrom: linePrefix.length });
    }
  } else if (/^black\s+hole(?:\s+\w*)?$/.test(prefix)) {
    ["on", "off"].forEach(value => add(value, "Black Hole state"));
  } else if (/^unlock(?:\s+\w*)?$/.test(prefix)) {
    ["nowait", "dilation",
      ...Array.from({ length: 12 }, (_, index) => [`ec${index + 1}`, `ec ${index + 1}`]).flat()]
      .forEach(value => add(value, "Feature or Eternity Challenge"));
  } else if (/^start(?:\s+\w*)?$/.test(prefix)) {
    ["dilation",
      ...Array.from({ length: 12 }, (_, index) => [`ec${index + 1}`, `ec ${index + 1}`]).flat()]
      .forEach(value => add(value, "Feature or Eternity Challenge"));
  } else if (/^wait\s+black\s+hole(?:\s+\w*)?$/.test(prefix)) {
    ["off", "bh1", "bh2"].forEach(value => add(value, "Black Hole state"));
  } else if (/^(?:if|while|until|wait)\s+/.test(prefix)) {
    [...currencies, ...Array.from({ length: 12 }, (_, index) => `ec${index + 1} completions`)]
      .forEach(value => add(value, "Automator currency"));
    if (/(?:<=|>=|<|>)\s*$/.test(prefix)) {
      ["1", "1e100"].forEach(value => add(value, "Number"));
    } else {
      ["infinity", "eternity", "reality"].forEach(value => add(value, "Prestige event"));
      ["<", "<=", ">", ">="].forEach(value => add(value, "Comparison operator"));
    }
  } else if (/^pause\s+/.test(prefix)) {
    ["10s", "1 minute", "1 hour"].forEach(value => add(value, "Duration"));
  } else if (/^notify\s*/.test(prefix)) {
    add('"text"', "Notification text");
  } else {
    for (const command of commandNames) {
      if (command.startsWith(prefix)) {
        add(command, "Automator command", command, { replaceLine: true });
      }
    }
  }

  return suggestions;
}

module.exports = {
  tokenizeAutomatorLine,
  validate,
  completionItems,
  currencies,
  commandNames,
  MAX_SCRIPT_CHARACTERS,
  scriptCharacterCount,
  formatScript,
  FormattingError
};
