# Automator Web Editor

## Run locally

From the repository root, install workspace dependencies if needed and start the Vite development server:

```powershell
corepack pnpm install
corepack pnpm --filter @adme/web-editor dev
```

Open <http://localhost:5173/> in a browser. Leave the terminal running while you use the editor; press `Ctrl+C` there to stop the server. After dependencies have been installed once, the `install` command can be skipped.

You can also run the app scripts from this directory:

```powershell
corepack pnpm dev
```

## Language assistance

- Type a command or parameter prefix, or press `Ctrl+Space`, to open shared Automator completions filtered to the current context. Use the arrow keys and `Enter` to select; on touch screens, tap an option.
- Select **Issues** to open the syntax diagnostics list. Click an item to jump to its source line. Diagnostics cover only the syntax checks implemented by this project; the game remains the authority on whether a script can run.
- Completion suggestions are contextual and do not cover every valid game input. Browser snippet expansion is not supported; `{name}` references remain ordinary source text.
- Open **Actions** to create a new script, import a text file, download the current script, copy all text, paste at the current selection, or format indentation with the shared safe formatter.
- Edits are saved to browser local storage after a short pause. If a draft is found at startup, choose **Restore draft** to load it or **Dismiss** to keep the current script. New Script asks before replacing nonempty content. Clipboard use depends on browser permission and a secure context such as `localhost`.

## Production build

From the repository root:

```powershell
corepack pnpm --filter @adme/web-editor build
```

The static output is written to `apps/web-editor/dist`. To serve that build locally:

```powershell
corepack pnpm --filter @adme/web-editor preview
```

Vite uses `/` as the default base path for local development. Set `VITE_BASE_PATH` at build time to a repository subpath when preparing a GitHub Pages build, for example `VITE_BASE_PATH=/my-repository/`.
