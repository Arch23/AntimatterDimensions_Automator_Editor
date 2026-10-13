"use strict";

const fs = require("node:fs");
const path = require("node:path");

class SnippetError extends Error {
  constructor(message) {
    super(message);
    this.name = "SnippetError";
  }
}

function expandScript(source, scriptPath, readOpenSnippet) {
  const extensionDirectory = path.join(path.dirname(scriptPath), "ext");
  const usedSnippets = new Set();

  function expand(content, activeSnippets, sourceLine) {
    const segments = content.split(/(\r\n|\r|\n)/);
    let line = sourceLine;
    const expanded = [];
    const sourceLines = [];
    for (const segment of segments) {
      if (/^(?:\r\n|\r|\n)$/.test(segment)) {
        expanded.push(segment);
        line++;
        continue;
      }
      const reference = segment.match(/^(\s*)\{([a-zA-Z0-9_-]+)\}(\s*)$/);
      if (!reference) {
        expanded.push(segment);
        sourceLines.push(line);
        continue;
      }
      const [, indentation, name, trailingWhitespace] = reference;
      if (activeSnippets.includes(name)) {
        throw new SnippetError(`Snippet cycle detected: ${[...activeSnippets, name].join(" -> ")}.`);
      }

      const snippetPath = [".snippet", ".snpt"]
        .map(extension => path.join(extensionDirectory, `${name}${extension}`))
        .find(candidate => fs.existsSync(candidate) || readOpenSnippet?.(candidate) !== undefined);
      if (!snippetPath) {
        throw new SnippetError(`Snippet '${name}' was not found in '${extensionDirectory}'. Expected ${name}.snippet or ${name}.snpt.`);
      }

      let snippet;
      try {
        snippet = readOpenSnippet?.(snippetPath);
        if (snippet === undefined) snippet = fs.readFileSync(snippetPath, "utf8");
      } catch (error) {
        if (error instanceof SnippetError) throw error;
        throw new SnippetError(`Could not read snippet '${name}' at '${snippetPath}': ${error.message}`);
      }

      usedSnippets.add(name);
      const nested = expand(snippet, [...activeSnippets, name], line);
      expanded.push(nested.content ? `${indentation}${nested.content}${trailingWhitespace}` : segment);
      sourceLines.push(...nested.sourceLines);
    }
    return { content: expanded.join(""), sourceLines };
  }

  const result = expand(source, [], 0);
  return { ...result, snippets: [...usedSnippets] };
}

module.exports = { expandScript, SnippetError };
