"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
let language;
let snippets;
try {
  language = require("@adme/automator-language");
  snippets = require("@adme/automator-language/node-snippets");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
  language = require("./vendor/automator-language");
  snippets = require("./vendor/automator-language/node-snippets");
}
const {
  validate,
  completionItems,
  MAX_SCRIPT_CHARACTERS,
  scriptCharacterCount,
  formatScript,
  FormattingError,
  tokenizeAutomatorLine
} = language;
const { expandScript, SnippetError } = snippets;

const snippetNamePattern = /^[a-zA-Z0-9_-]+$/;
const semanticTokenTypes = [
  "automatorControl", "automatorCommand", "automatorSubcommand", "automatorModifier",
  "automatorCurrency", "automatorConstant", "automatorNumber", "automatorRange",
  "automatorOperator", "automatorComment", "automatorString", "automatorSnippet", "automatorPunctuation"
];
const semanticTokenTypeIndex = new Map(semanticTokenTypes.map((type, index) => [type, index]));
const semanticTypeFor = {
  control: "automatorControl",
  command: "automatorCommand",
  subcommand: "automatorSubcommand",
  modifier: "automatorModifier",
  currency: "automatorCurrency",
  constant: "automatorConstant",
  number: "automatorNumber",
  range: "automatorRange",
  operator: "automatorOperator",
  comment: "automatorComment",
  string: "automatorString",
  snippet: "automatorSnippet",
  punctuation: "automatorPunctuation"
};

const semanticTokenLegend = new vscode.SemanticTokensLegend(semanticTokenTypes, []);
const semanticTokenProvider = {
  provideDocumentSemanticTokens(document) {
    const builder = new vscode.SemanticTokensBuilder(semanticTokenLegend);
    for (let lineNumber = 0; lineNumber < document.lineCount; lineNumber++) {
      const line = document.lineAt(lineNumber).text;
      for (const token of tokenizeAutomatorLine(line, { includeSnippets: true })) {
        const type = semanticTokenTypeIndex.get(semanticTypeFor[token.type]);
        if (type !== undefined) builder.push(lineNumber, token.start, token.end - token.start, type);
      }
    }
    return builder.build();
  }
};

function isAutomatorDocument(document) {
  return Boolean(document && document.languageId === "automator");
}

function isSavedAutomatorDocument(document) {
  return isAutomatorDocument(document) && document.uri.scheme === "file";
}

function readOpenSnippet(snippetPath) {
  const targetPath = path.resolve(snippetPath);
  const document = vscode.workspace.textDocuments.find(candidate =>
    candidate.uri.scheme === "file" &&
    path.resolve(candidate.uri.fsPath) === targetPath
  );
  return document?.getText();
}

function snippetCompletionItems(document, linePrefix, position) {
  const reference = linePrefix.match(/\{([a-zA-Z0-9_-]*)$/);
  if (!reference || !isSavedAutomatorDocument(document)) return [];

  const extensionDirectory = path.join(path.dirname(document.uri.fsPath), "ext");
  const openSnippetFiles = vscode.workspace.textDocuments
    .filter(candidate => isSnippetForDocument(candidate, document))
    .map(candidate => path.resolve(candidate.uri.fsPath));
  let filenames = [];
  try {
    if (fs.existsSync(extensionDirectory)) filenames = fs.readdirSync(extensionDirectory);
  } catch (error) {
    console.error(`Could not list Automator snippets in '${extensionDirectory}': ${error.message}`);
  }
  const candidates = new Set([
    ...filenames.map(filename => path.resolve(extensionDirectory, filename)),
    ...openSnippetFiles
  ]);
  const names = new Set();
  for (const candidate of candidates) {
    const extension = path.extname(candidate).toLowerCase();
    const name = path.basename(candidate, path.extname(candidate));
    if ([".snippet", ".snpt"].includes(extension) && snippetNamePattern.test(name)) names.add(name);
  }

  const start = linePrefix.lastIndexOf("{") + 1;
  return [...names]
    .filter(name => name.toLowerCase().startsWith(reference[1].toLowerCase()))
    .map(name => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = "Automator snippet";
      item.insertText = `${name}}`;
      item.range = new vscode.Range(position.line, start, position.line, position.character);
      return item;
    });
}

function publishDiagnostics(document, collection) {
  let source = document.getText();
  let sourceLineMap;
  try {
    if (isSavedAutomatorDocument(document)) {
      const expanded = expandScript(source, document.uri.fsPath, readOpenSnippet);
      source = expanded.content;
      sourceLineMap = expanded.sourceLines;
    }
  } catch (error) {
    if (error instanceof SnippetError) {
      const range = new vscode.Range(0, 0, 0, Math.max(1, document.lineAt(0).text.length));
      collection.set(document.uri, [new vscode.Diagnostic(range, error.message, vscode.DiagnosticSeverity.Error)]);
      return;
    }
    throw error;
  }
  const diagnostics = validate(source).map(item => {
    const mappedLine = sourceLineMap?.[item.line];
    const line = mappedLine ?? item.line;
    const start = mappedLine === undefined ? item.start : 0;
    const end = mappedLine === undefined
      ? item.end
      : Math.max(1, document.lineAt(line).text.length);
    const range = new vscode.Range(
      line,
      start,
      line,
      end
    );
    return new vscode.Diagnostic(
      range,
      item.message,
      vscode.DiagnosticSeverity.Error
    );
  });
  collection.set(document.uri, diagnostics);
}

function updateCharacterCount(editor, statusBarItem) {
  if (!editor || !isAutomatorDocument(editor.document)) {
    statusBarItem.hide();
    return;
  }

  const source = editor.document.getText();
  const sourceCount = scriptCharacterCount(source);
  let count = sourceCount;
  let snippetNames = [];
  let expansionError;
  if (editor.document.uri.scheme === "file") {
    try {
      const expanded = expandScript(source, editor.document.uri.fsPath, readOpenSnippet);
      count = scriptCharacterCount(expanded.content);
      snippetNames = expanded.snippets;
    } catch (error) {
      if (!(error instanceof SnippetError)) throw error;
      expansionError = error;
    }
  }
  const limit = MAX_SCRIPT_CHARACTERS.toLocaleString("en-US");
  const displayCount = count.toLocaleString("en-US");
  statusBarItem.text = snippetNames.length > 0
    ? `$(symbol-numeric) ${sourceCount.toLocaleString("en-US")} -> ${displayCount} / ${limit} chars`
    : expansionError
      ? `$(symbol-numeric) ${sourceCount.toLocaleString("en-US")} + snippets (?) / ${limit} chars`
      : `$(symbol-numeric) ${displayCount} / ${limit} chars`;
  statusBarItem.tooltip = expansionError
    ? expansionError.message
    : snippetNames.length > 0
      ? `Expanded script character count (including snippets): ${displayCount} of ${limit}.\nUsed snippets: ${snippetNames.join(", ")}`
      : editor.document.uri.scheme !== "file"
        ? `Save this script to resolve adjacent snippets. Current text count: ${displayCount} of ${limit}.`
        : `Automator script character count using game-style line endings and blank-line handling. Limit: ${limit} characters.`;
  const overLimit = !expansionError && count > MAX_SCRIPT_CHARACTERS;
  statusBarItem.backgroundColor = expansionError || overLimit
    ? new vscode.ThemeColor("statusBarItem.errorBackground")
    : undefined;
  statusBarItem.color = expansionError || overLimit
    ? new vscode.ThemeColor("statusBarItem.errorForeground")
    : undefined;
  statusBarItem.show();
}

async function buildScript(document) {
  if (!isSavedAutomatorDocument(document)) {
    await vscode.window.showErrorMessage("Build requires a saved .automator or .aut script.");
    return;
  }

  const sourcePath = document.uri.fsPath;
  const outputPath = sourcePath.replace(/\.(?:automator|aut)$/i, ".built.automator");
  let expanded;
  try {
    expanded = expandScript(document.getText(), sourcePath, readOpenSnippet);
  } catch (error) {
    if (error instanceof SnippetError) {
      await vscode.window.showErrorMessage(error.message);
      return;
    }
    throw error;
  }

  const characterCount = scriptCharacterCount(expanded.content);
  if (characterCount > MAX_SCRIPT_CHARACTERS) {
    await vscode.window.showErrorMessage(
      `Expanded script is ${characterCount.toLocaleString("en-US")} characters; the limit is ${MAX_SCRIPT_CHARACTERS.toLocaleString("en-US")}.`
    );
    return;
  }

  if (fs.existsSync(outputPath)) {
    const choice = await vscode.window.showWarningMessage(
      `${path.basename(outputPath)} already exists. Replace it?`,
      { modal: true },
      "Replace"
    );
    if (choice !== "Replace") return;
  }

  try {
    fs.writeFileSync(outputPath, expanded.content, "utf8");
    const outputDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(outputPath));
    await vscode.window.showTextDocument(outputDocument);
    await vscode.window.showInformationMessage(
      `Built ${path.basename(outputPath)} (${characterCount.toLocaleString("en-US")} characters; ${expanded.snippets.length} snippet${expanded.snippets.length === 1 ? "" : "s"} expanded).`
    );
  } catch (error) {
    await vscode.window.showErrorMessage(`Could not write the built script: ${error.message}`);
  }
}

function activate(context) {
  const diagnostics = vscode.languages.createDiagnosticCollection("automator");
  const characterCount = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(diagnostics);
  context.subscriptions.push(characterCount);
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "automator", scheme: "*" },
      semanticTokenProvider,
      semanticTokenLegend
    )
  );

  for (const document of vscode.workspace.textDocuments) {
    if (isAutomatorDocument(document)) publishDiagnostics(document, diagnostics);
  }
  updateCharacterCount(vscode.window.activeTextEditor, characterCount);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(document => {
      if (isAutomatorDocument(document)) publishDiagnostics(document, diagnostics);
      updateCharacterCount(vscode.window.activeTextEditor, characterCount);
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (isAutomatorDocument(event.document)) publishDiagnostics(event.document, diagnostics);
      const activeDocument = vscode.window.activeTextEditor?.document;
      if (activeDocument === event.document ||
        (isAutomatorDocument(activeDocument) && isSnippetForDocument(event.document, activeDocument))) {
        updateCharacterCount(vscode.window.activeTextEditor, characterCount);
      }
    }),
    vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)),
    vscode.window.onDidChangeActiveTextEditor(editor => updateCharacterCount(editor, characterCount)),
    vscode.languages.registerCompletionItemProvider({ language: "automator", scheme: "*" }, {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
        const snippets = snippetCompletionItems(document, linePrefix, position);
        const completions = completionItems(linePrefix).map(item => {
          const completion = new vscode.CompletionItem(
            item.label,
            vscode.CompletionItemKind.Keyword
          );
          completion.detail = item.detail;
          completion.insertText = item.insertText;
          completion.filterText = item.filterText;
          if (item.replaceLine) {
            completion.range = new vscode.Range(position.line, 0, position.line, position.character);
          } else if (item.replaceFrom !== undefined) {
            completion.range = new vscode.Range(
              position.line,
              item.replaceFrom,
              position.line,
              position.character
            );
          }
          return completion;
        });
        return [...snippets, ...completions];
      }
    }, " ", "<", ">", "#", "n", "x", "{", ..."_abcdefghijklmnopqrstuvwxyz".split("")),
    vscode.commands.registerCommand("automator.validate", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isAutomatorDocument(editor.document)) {
        publishDiagnostics(editor.document, diagnostics);
        vscode.window.showInformationMessage("Automator script validation complete.");
      }
    }),
    vscode.commands.registerCommand("automator.build", () => {
      const editor = vscode.window.activeTextEditor;
      return editor ? buildScript(editor.document) : undefined;
    }),
    vscode.commands.registerCommand("automator.format", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isAutomatorDocument(editor.document)) return;
      const document = editor.document;
      try {
        const formatted = formatScript(document.getText());
        if (formatted !== document.getText()) {
          const range = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
          await editor.edit(edit => edit.replace(range, formatted));
        }
      } catch (error) {
        if (error instanceof FormattingError) {
          await vscode.window.showWarningMessage(error.message);
          return;
        }
        throw error;
      }
    })
  );
}

function isSnippetForDocument(candidate, scriptDocument) {
  if (!candidate || candidate.uri.scheme !== "file" || scriptDocument.uri.scheme !== "file") return false;
  const extension = path.extname(candidate.uri.fsPath).toLowerCase();
  return [".snippet", ".snpt"].includes(extension) &&
    path.dirname(candidate.uri.fsPath) === path.join(path.dirname(scriptDocument.uri.fsPath), "ext");
}

function deactivate() {}

module.exports = { activate, deactivate };
