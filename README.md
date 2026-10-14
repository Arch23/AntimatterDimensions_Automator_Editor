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

The browser editor currently provides editing, syntax highlighting, shared contextual completions and syntax diagnostics, text-file import/download, clipboard actions, local draft recovery, safe indentation formatting, and a game-style character counter for the 10,000-character script limit. Browser snippet expansion and offline caching are not included. The web editor provides a PWA manifest and app icon metadata for installation. GitHub Pages deployment is configured by the web-editor workflow; see the plan and web-editor README for setup and remaining review.

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

## Security checks

Install Gitleaks **8.30.1** from the [official releases](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1) and make sure `gitleaks` is on `PATH`. The repository config extends Gitleaks' default rules. Checks fail if the pinned version is unavailable; they do not silently skip scanning.

After cloning, install this clone's local Git hooks:

```sh
corepack pnpm security:install-hooks
```

The pre-commit hook checks the Git index for prohibited filenames and scans the staged file contents with Gitleaks. The pre-push hook runs the complete security command. Hooks live in `.git/hooks`, are not committed, and must be installed for each clone.

Run the complete check at any time:

```sh
corepack pnpm security:check
```

This checks prohibited filenames in the Git index (including paths tracked before ignore rules), changed and untracked working-tree file contents, staged file contents, and all commits reachable from local Git refs. The working-tree and staged scans are separate because Git can contain staged content that differs from the working copy. It does not inspect remote refs that have not been fetched, detect every possible secret format, or replace credential rotation and history cleanup. CI fetches full history and runs this command on all pull requests and pushes to `main`.

Run the isolated harness verification with `corepack pnpm security:test`. It uses only temporary repositories and unmistakably fake values.

### Security findings and remediation

- Keep untracked local credentials out of Git and ensure `.gitignore` covers them.
- For a staged secret, unstage it and remove it from the staged change, then verify `corepack pnpm security:staged` passes.
- For an already tracked sensitive file, remove only its index entry with `git rm --cached -- <path>`; this keeps the local copy. Then run `corepack pnpm security:check`.
- If a real secret was committed or pushed, revoke or rotate it first. Then assess history cleanup and coordinate with collaborators; this harness never rewrites history or deletes local files.
- Review confirmed false positives narrowly. For a sensitive filename, add one exact path with a specific `reason` and `reviewedBy` to `.security-allowlist.json`. For a Gitleaks finding, add only its exact fingerprint to `.gitleaksignore` and document the reason here. Both exceptions remain subject to secret scanning when content is scanned. Never add broad path exclusions.
- `.env.example` is the only automatic filename exception; keep it sanitized and use placeholders. It is still scanned for secrets.

No Firebase configuration or Firestore rules exist in this repository at the time this harness was added. If Firebase is added later, treat web configuration as public and enforce authenticated UID ownership in Firestore rules; never add Admin SDK credentials or private user data.

## Project status

The shared language package, conservative formatter, browser editor surface, cross-editor highlighting, contextual completions, syntax diagnostics, document actions, local draft recovery, and GitHub Pages deployment are implemented. The web editor has a PWA manifest and app icons; offline caching remains a possible future enhancement.
