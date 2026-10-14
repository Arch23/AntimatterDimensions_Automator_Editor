# Automator Editor

This project provides a VS Code extension and browser editor for scripts compatible with Antimatter Dimensions Automator. Both editors share language services from a pnpm workspace package.

This is an unofficial community project and is not affiliated with or endorsed by the Antimatter Dimensions developers. The game remains the authority for whether a script is valid and can run; this editor provides syntax assistance only.

## Workspace

| Path | Purpose |
| --- | --- |
| `extensions/vscode-extension` | VS Code language extension for `.aut` and `.automator` scripts. |
| `apps/web-editor` | Static browser editor built with Vite and CodeMirror 6. |
| `packages/automator-language` | Shared browser-safe validation, completion, formatting, and tokenization logic. |

See [Technical Overview](TECHNICAL-OVERVIEW.md) for architecture and implementation details. The [Automator Language Reference](extensions/vscode-extension/AUTOMATOR-LANGUAGE.md) describes the syntax supported by the editor tools.

## License

This project is licensed under the [MIT License](LICENSE).

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

The browser editor currently provides editing, syntax highlighting, shared contextual completions and syntax diagnostics, text-file import/download, clipboard actions, local draft recovery, and safe indentation formatting. Browser snippet expansion and offline caching are not included. The web editor provides a PWA manifest and app icon metadata for installation. GitHub Pages deployment is configured by the web-editor workflow; see the plan and web-editor README for setup and remaining review.

## Run the VS Code extension

Open `extensions/vscode-extension` in VS Code and press `F5` to launch an Extension Development Host. Use a `.aut` or `.automator` file to try the language support. Extension-specific setup and features are in [extensions/vscode-extension/README.md](extensions/vscode-extension/README.md).

## Test and package

Run the shared language and web-editor adapter tests:

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

The shared language package, conservative formatter, browser editor surface, cross-editor highlighting, contextual completions, syntax diagnostics, document actions, local draft recovery, and GitHub Pages deployment are implemented. The web editor has a PWA manifest and app icons; offline caching remains a possible future enhancement.
