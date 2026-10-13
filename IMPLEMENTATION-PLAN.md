# Automator Web Editor Implementation Plan

## Goal

Build a mobile-first, static web editor for Antimatter Dimensions Automator scripts, using the shared language package in `packages/automator-language`. Keep the VS Code extension working and treat the game as the authority for runtime validity. The first release is an editor and local script utility; it will not execute scripts or send them to a service.

## Repository findings

- The VS Code extension now lives at `extensions/vscode-extension`, with the web app reserved at `apps/web-editor` and shared language code at `packages/automator-language`.
- The root is a pnpm workspace. The web app package is scaffolded and depends on the shared language workspace package; CodeMirror/Vite application code is still pending.
- Shared browser-safe validation, completion, metadata, character counting, and formatting live in `packages/automator-language/src/index.js`. Node filesystem snippet expansion is isolated in `src/node-snippets.js` and remains available to the VS Code adapter.
- Existing Node tests were moved under the language package. The root test script delegates to that package. The extension remains plain JavaScript; its VSIX prepublish hook copies the shared runtime files into the package for installed extensions.
- `syntaxes/automator.tmLanguage.json` provides TextMate highlighting; `language-configuration.json` defines braces, comments, and quote pairing. Examples in `Examples/*.aut` and the language reference remain fixtures for behavior and UI checks.
- Highlighting is currently implemented twice: the extension has a TextMate grammar, while the web editor has an independent CodeMirror stream tokenizer and theme. Their token boundaries and coloring can therefore drift.
- The validator result shape has line/start/end/message and severity. The web adapter should preserve those results and only display warnings if the language logic provides them.

## Proposed shape

Use a pnpm workspace with separate integrations and a shared language package:

Suggested new app files:

```text
apps/web-editor/
  package.json
  index.html
  vite.config.ts
  src/
    main.ts
    editor.ts
    storage.ts
    file-actions.ts
    styles.css
```

`packages/automator-language` owns browser-safe syntax, validation, completion, formatting, and metadata. The VS Code extension remains an adapter and retains its filesystem-based snippet expansion/build behavior. Node filesystem snippet code must be isolated from the browser-safe package entry. Use CodeMirror 6 for editor behavior and a dedicated highlighting adapter informed by the TextMate grammar; do not assume the VS Code grammar can be loaded directly by CodeMirror. Configure Vite for a repository-based GitHub Pages base path without hardcoding an owner or repository name.

Use pnpm workspaces so the app and VS Code extension consume the same language package. Keep the web app under `apps/web-editor` and shared rules under `packages/automator-language`.

## Implementation phases

### 1. Establish a behavior baseline

- Treat the current extension and its tests as the baseline; use the existing examples and `AUTOMATOR-LANGUAGE.md` as representative scripts.
- Record which language rules are actually implemented versus merely documented. Preserve snippet expansion as an extension feature unless browser-local snippet import becomes an explicitly scoped requirement.
- Use `VITE_BASE_PATH` as Vite's build-time `base` input: default to `/` for local development and supply `/<repository-name>/` from the Pages workflow. Do not hardcode an account, repository, or deployment URL into app source.

Status: completed. The implementation baseline is:

| Area | Implemented behavior | Limits to preserve in the web editor |
| --- | --- | --- |
| Highlighting | TextMate grammar scopes comments, quoted strings, snippet references, control words, commands, modifiers, comparison operators, numbers, currencies, constants, ranges, and braces. | This is a regex-based highlighting grammar, not a full parser or validation source. Implement a CodeMirror-specific adapter and compare it against real examples. |
| Validation | A line-oriented validator checks recognized command forms and arguments, comparison operators, supported block headers/braces, and the 10,000-character limit. It returns line/column ranges, messages, and error severity. | It does not execute scripts or validate game state. Variable-shaped identifiers are accepted without checking whether they are defined; study IDs/ranges are syntax-checked but not checked against the game's tree. Treat the results as editor diagnostics, not proof a script is valid. |
| Completion | Prefix/context-based suggestions cover commands and selected argument contexts, including currencies, comparison operators, prestige events, and common settings. | Suggestions are not a complete grammar or semantic model. VS Code snippet-name completion is an adapter feature that reads adjacent files and is excluded from the web release. |
| Formatting | `formatScript` changes leading indentation based on recognized blocks and preserves the rest of the source. | It refuses malformed or unsupported block structure; it is not a command-spacing or canonical pretty-printer. |
| Snippet expansion | The VS Code adapter expands nested `.snippet`/`.snpt` files from the adjacent `ext` directory and handles missing files and cycles. | Node filesystem-based behavior stays in the VS Code integration. The web editor leaves `{name}` references as text and does not expand or validate snippet contents. |
| Fixtures and tests | Five real `.aut` examples and the existing language reference are present. The Node test suite covers command forms, comparisons, blocks, character limits, snippet expansion, and representative completions; formatter preservation/refusal tests have also been added. | Keep real examples as primary fixtures. Do not infer runtime semantics from editor fixtures or invent syntax to fill gaps. |

The behavior baseline comes from `packages/automator-language/src/index.js`, the TextMate grammar and VS Code language configuration, `AUTOMATOR-LANGUAGE.md`, `sintax.txt`, `keywords.txt`, the five `Examples/*.aut` files, and the language package tests. The reference and older syntax notes describe more than the validator can prove, so implementation and UI claims must follow the actual validator behavior above.

### 2. Implement conservative formatting first

- Before scaffolding the web app or changing the package layout, add a shared formatter that changes leading indentation only, using two spaces per recognized block by default.
- Preserve command text, all non-leading whitespace, strings, comments, line ordering, blank lines, and original line endings. Re-indent standalone comments to the current block depth.
- If a block header or brace structure is malformed or unsupported, refuse the edit and leave the document untouched. Apply a successful change as one VS Code edit so it can be undone normally.
- Use the same formatter from both integrations once they consume the shared language package.

Status: implemented in `packages/automator-language/src/index.js` and registered as **Automator: Format Document** in the VS Code extension. Preservation and refusal behavior have dedicated tests. Step 6 wires the same formatter into the browser editor.

### 3. Separate reusable language logic

- Keep validation, completion, metadata, character counting, and formatting in the browser-safe shared language package.
- Move filesystem-backed snippet loading/expansion behind a Node-only boundary, or make expansion accept an injected snippet resolver with no static Node imports in the browser bundle.
- Keep the VS Code extension as a thin adapter over the same language behavior and preserve its diagnostics, completions, character counter, and build command.
- Keep Node filesystem snippet resolution outside the browser-safe package entry.

Status: implemented and verified. The shared language entry has no Node filesystem imports; snippet filesystem access is in `src/node-snippets.js`. The VS Code adapter consumes the package, and VSIX preparation vendors the shared runtime. The workspace test command passed all 17 tests, and VSIX packaging produced the artifact in the root `bin/` folder.

### 4. Build the usable editing surface

- Add a TypeScript + Vite app using CodeMirror 6, configured for static Pages hosting.
- Implement a responsive dark editor with line numbers, undo/redo, selection, bracket matching, indentation, touch-friendly controls, and horizontal scrolling for long lines.
- Add Automator highlighting based on the existing grammar, then compare representative `.aut` examples against the extension's scopes.
- Start with a compact toolbar and collapsible/contextual panels so the editor retains vertical space on a portrait phone.

Status: implemented. The Vite app now mounts CodeMirror 6 with line numbers, history/undo/redo, active-line and selection styling, bracket matching/closing, two-space indentation, and horizontal scrolling. Its stream-language adapter follows the existing TextMate grammar categories and its initial document loads the real `climb_ep.aut` fixture. The layout uses a compact touch-sized toolbar and a dynamic viewport-height editor. TypeScript and the production Vite build pass; interaction and phone-size visual review remain to be done when browser preview is available.

### 4a. Align syntax highlighting across editors

This is a planned consistency pass prompted by differences seen while comparing the extension and browser editor. Do it before relying on highlighting during later language-assistance work.

- Define one documented token taxonomy for both adapters: control-flow keywords, primary command words, command subcommands/arguments where they are reserved words, modifiers, currencies, constants, numbers, operators, strings, comments, snippet references, and block punctuation.
- Treat the command's primary word (for example `studies`, `eternity`, or `unlock`) as a distinct token from modifiers such as `nowait` and `respec`. Choose explicit theme colors for primary commands and modifiers so they remain visibly different in both editors. Keep non-keyword argument text uncolored as a keyword unless the shared taxonomy identifies it as a reserved token.
- Fix the web tokenizer to recognize commands after leading indentation and to emit separate tokens for primary command words and modifiers, instead of styling an entire command phrase as one keyword. Preserve nested-block behavior and ensure comments/strings take precedence over keyword matching.
- Update the TextMate grammar to capture the same token boundaries and categories, including `studies` commands and valid modifier positions. Keep snippet-reference highlighting extension-only; the browser continues to treat `{name}` as plain text under the no-snippets decision.
- Establish representative parity fixtures from `Examples/*.aut` plus focused cases for indented commands, `studies respec`, `studies nowait load/purchase`, prestige commands with `nowait`/`respec`, control-flow headers, comments, and strings containing keyword text.
- Verify both adapters produce the intended category boundaries for those cases, then visually compare them using equivalent editor themes. Theme colors may differ only where the host editor imposes its own color mapping; token categories and boundaries must agree.

Status: implemented and verified. `packages/automator-language/src/highlighting.js` now provides shared line-token categories used by the browser's CodeMirror adapter and the VS Code semantic-token provider. The TextMate grammar was aligned for `studies` commands, and extension-only snippet coloring remains opt-in. Focused tests cover indented commands, separate command/modifier spans, keyword text in comments/strings, and all real `.aut` examples. Browser primary commands use a distinct color from modifiers; VS Code semantic scopes preserve theme-aware command and modifier coloring. All 21 shared-language tests pass, the web production build passes, and VSIX packaging succeeds with the shared highlighter included in its vendor files.

### 5. Add language assistance

- Connect shared completion logic to CodeMirror completion sources, mapping its labels, replacement ranges, and details. Verify keyboard navigation and touch selection.
- Position or constrain completion UI so it remains usable near the active line and mobile keyboard.
- Map shared diagnostics into CodeMirror lint diagnostics with their source ranges and messages. Clearly label that diagnostics cover only implemented syntax checks.
- Do not add speculative rules or report a warning/error severity that the underlying validator does not establish.

Status: implemented. CodeMirror completions use the shared completion results, including their details and replacement behavior, while suppressing suggestions inside comments and strings. The completion list filters/ranks against the current parameter prefix, including the matching word within multiword currencies. Completion selection supports the standard keyboard controls and has a constrained, touch-sized popup. Shared validator results appear as CodeMirror lint diagnostics and in a collapsible Issues list; the UI states that these are implemented syntax checks and that the game remains authoritative. The web production build passes.

### 6. Add document actions and persistence

- Implement copy-all and paste through user-triggered clipboard actions with visible permission/error feedback.
- Implement text-file import and plain-text download/export.
- Save and restore a local draft with browser storage; show save status and handle unavailable/full storage without losing the active editor content.
- Make New Script confirm before replacing nonempty content and ensure draft restoration does not silently overwrite the user's current text.
- Wire the shared conservative formatter into the web editor's format-document action.
- Snippet completion/import/expansion is explicitly out of scope for the first web release. Keep `{name}` references as ordinary text; do not claim that the browser can resolve or build them. The VS Code extension keeps its current adjacent `ext` folder behavior.

Status: implemented. The web editor has user-triggered copy-all and paste actions with visible success/error feedback, text-file import and plain-text download, and debounced local draft autosave. A found draft is offered through an explicit Restore/Dismiss prompt and never silently replaces the currently open example or script. New Script confirms before replacing nonempty content. The Format action calls the shared conservative formatter and applies a successful result as one undoable document change. Browser snippets remain out of scope. The TypeScript check and production web build pass.

### 7. Verify and deploy

- Extend coverage for shared validation/completion and their CodeMirror mappings, plus safe formatter behavior if delivered.
- Test representative fixtures from `Examples/`, including nested blocks and comments, for display and editor interactions.
- Verify production build output and the Pages base path, then add a GitHub Actions workflow scoped to the web app so extension-only changes do not trigger an unnecessary deploy.
- Document local development, supported language checks, draft behavior, and the repository Pages settings needed to enable deployment.
- Consider installable PWA/offline behavior after the first usable release.

## Acceptance checklist

- Existing VS Code extension behavior and tests remain intact.
- Static web app edits Automator scripts with consistent highlighting and mobile-usable controls.
- The extension and web editor assign the same token categories to representative Automator source; primary command words and modifiers have distinct token categories and clear theme colors.
- Completion and diagnostics reuse the shared language rules and indicate their limits honestly.
- Copy, paste, import, export, and local draft restore work without a backend.
- Formatting changes leading indentation only and refuses malformed or unsupported block structure.
- Production assets work under a repository Pages path, and deployment/setup steps are documented.

## Decisions made

- Use a pnpm workspace with `packages/automator-language`, `apps/web-editor`, and `extensions/vscode-extension` so shared language rules can serve both editor integrations.
- Pin pnpm through the root `packageManager` field and use the root test script to run the shared language package's existing Node tests.
- Write generated VS Code `.vsix` packages into the root `bin/` folder and ignore that folder in Git.
- Configure Vite `base` from `VITE_BASE_PATH`; use `/` locally and have the GitHub Pages workflow provide the repository subpath at build time.
- Implement formatting before other workspace/web-app code: conservative leading-indentation normalization only, two spaces per block by default, with refusal on malformed/unsupported block structure.
- Leave snippets out of the web release. Keep the extension's current file-based snippets and treat brace-wrapped references as plain source text in the web app.
- Do not implement any additional whitespace normalization or semantic transformations without a separately agreed rule and preservation coverage.
