# Antimatter Dimensions Automator Tools

This repository contains editor support for Antimatter Dimensions Automator scripts. A VS Code extension and an in-progress browser editor share language services from a pnpm workspace package.

The game's Automator is the authority on whether a script is valid and can run. The editor checks are syntax assistance only.

## Workspace

| Path | Purpose |
| --- | --- |
| `extensions/vscode-extension` | VS Code language extension for `.aut` and `.automator` scripts. |
| `apps/web-editor` | Static browser editor built with Vite and CodeMirror 6. |
| `packages/automator-language` | Shared browser-safe validation, completion, formatting, and tokenization logic. |
| `IMPLEMENTATION-PLAN.md` | Implementation phases, completed work, and project decisions. |

See [Technical Overview](TECHNICAL-OVERVIEW.md) for architecture and implementation details. The [Automator Language Reference](extensions/vscode-extension/AUTOMATOR-LANGUAGE.md) describes the syntax supported by the editor tools.

## Requirements

- Node.js `^20.19.0` or `>=22.12.0` (Vite 8 requirement).
- Corepack with pnpm 10, as pinned by the root `package.json`.
- VS Code is only required to run or install the extension.

Install workspace dependencies from the repository root:

```sh
corepack pnpm install
```

## Run the browser editor

Start Vite from the repository root:

```sh
corepack pnpm --filter @adme/web-editor dev
```

Open <http://localhost:5173/>. Keep the terminal running while using the app; press `Ctrl+C` to stop it. More web-editor commands and current browser limitations are documented in [apps/web-editor/README.md](apps/web-editor/README.md).

The browser editor currently provides editing, syntax highlighting, shared contextual completions and syntax diagnostics, text-file import/download, clipboard actions, local draft recovery, and safe indentation formatting. Browser snippet expansion and deployment automation have not been implemented yet. See the plan for current phase status.

## Run the VS Code extension

Open `extensions/vscode-extension` in VS Code and press `F5` to launch an Extension Development Host. Use a `.aut` or `.automator` file to try the language support. Extension-specific setup and features are in [extensions/vscode-extension/README.md](extensions/vscode-extension/README.md).

## Test and package

Run the shared language package tests:

```sh
corepack pnpm test
```

Build the web editor:

```sh
corepack pnpm --filter @adme/web-editor build
```

Create a local VS Code extension package:

```sh
corepack pnpm package:vscode
```

The VSIX is written to `bin/`, which is ignored by Git. Install it in VS Code with **Extensions: Install from VSIX…**.

## Project status

The shared language package, conservative formatter, browser editor surface, cross-editor highlighting, contextual completions, syntax diagnostics, document actions, and local draft recovery are implemented. Remaining web-editor work is tracked in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md), including deployment and broader integration review.
