# Automator Web Editor

Unofficial browser editor for scripts compatible with Antimatter Dimensions Automator. This project is not affiliated with or endorsed by the Antimatter Dimensions developers.

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

The status bar shows the game-style character count against the 10,000-character per-script limit. It normalizes line endings and excludes empty lines to match the shared language logic; the counter turns red when the limit is exceeded.

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

## GitHub Pages deployment

The repository workflow at `.github/workflows/deploy-web-editor.yml` installs the pnpm workspace, runs both Node test suites, builds the web app with the repository-specific Pages path, and publishes `apps/web-editor/dist`. It runs for pull requests and pushes that change the web editor, shared language package, example scripts, workspace manifests, or the workflow itself. Deployment is limited to pushes on the repository's default branch.

To enable publishing, open **Settings > Pages** and select **GitHub Actions** as the build and deployment source. The workflow publishes a project site at `https://<owner>.github.io/<repository>/`; for a user or organization site named `<owner>.github.io`, it builds with the root path. Pull requests run tests and a production build without deploying. The web app includes a PWA manifest and icon metadata for browser installation. Offline caching and a service worker are not configured.
