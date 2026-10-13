# Antimatter Dimensions Automator for VS Code

This extension provides basic live diagnostics and IntelliSense for Antimatter Dimensions Automator scripts.

## Use

Save scripts with the `.automator` or `.aut` extension, or choose **Automator** from the VS Code language-mode picker. The extension reports malformed commands, invalid comparisons, and unbalanced blocks as you edit. Press `Ctrl+Space` (`Cmd+Space` on macOS) for command, context-aware, and snippet-name completions. Inline AI suggestions and word-based suggestions are disabled for Automator files so regular prose does not appear as a completion.

Automator commands, flow-control keywords, currencies, comparison operators, values, strings, and comments have separate syntax scopes. Their displayed colors depend on the active VS Code color theme.

The status bar shows the active script's character count against the 10,000-character per-script limit. It turns red and reports an error if the script exceeds the limit. The counter normalizes line endings and omits empty lines to match the in-game count; indentation and other characters on nonempty lines are included. For scripts using snippets, it displays the raw and expanded counts and updates while an open snippet is edited. The game-only combined 60,000-character limit and in-game script-name limit are not checked.

### Snippets

Place reusable code in an `ext` folder beside the main `.automator` or `.aut` file. Each snippet is a `.snippet` or `.snpt` file. Insert it with `{snippet-name}`; nested snippet references are expanded too. Choose **Automator: Build Script (Expand Snippets)** from the Command Palette or the editor title bar to write a sibling `.built.automator` file. The source is never overwritten; if the output already exists, VS Code asks before replacing it. Missing snippets, recursive cycles, and expanded scripts over 10,000 characters prevent the build.

Run **Automator: Validate Script** from the Command Palette to refresh diagnostics for the active Automator document.

See `AUTOMATOR-LANGUAGE.md` in the project folder for command syntax, currencies, comparisons, blocks, and examples.

The linter implements the syntax described by `sintax.txt` and the command inventory in `keywords.txt`. It is intentionally a basic editor aid, not a replacement for validation by the game itself.

### Format a script

Run **Automator: Format Document** from the Command Palette or editor title bar. Formatting changes leading indentation to two spaces per recognized block level; it leaves command contents, strings, comments, trailing whitespace, blank lines, line order, and line endings intact. If a block header or brace structure is malformed or unsupported, formatting is skipped and the document is left unchanged.

## Development

The shared language rules live in the pnpm workspace package `packages/automator-language`. To try the extension locally:

1. From the repository root, run `pnpm install` so the extension can resolve the shared language package.
2. Open `extensions/vscode-extension` in VS Code.
3. Press `F5` (or choose **Run > Start Debugging**) to launch an Extension Development Host. The debug launch uses an isolated VS Code profile under `.vscode-test` and disables other installed extensions to avoid conflicts; this project extension is still loaded.
4. In that new VS Code window, open or create a `.automator` file and try editing it.

Node.js is required for workspace setup and tests. From the repository root, enable Corepack if needed, then run `pnpm install` and `pnpm test`. The language package has no external runtime dependencies.

## Package for personal installation

To create a local VSIX without publishing, first run `pnpm install` from the repository root, then run this from the repository root:

```sh
pnpm package:vscode
```

The VSIX is written to `bin/antimatter-dimensions-automator-3.0.0.vsix`. The `bin/` directory is ignored by Git. Packaging copies the shared language modules into the extension package; `.vscodeignore` excludes Automator scripts and development-only files. Install the resulting `.vsix` from **Extensions > ... > Install from VSIX...**.
