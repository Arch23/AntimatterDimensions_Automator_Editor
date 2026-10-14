# Repository instructions

## Security requirements

- Never add secrets, credentials, access tokens, refresh tokens, private keys, service-account files, OAuth client secrets, production environment files, real user data, or local database files to Git.
- Never hardcode credentials into application source code, tests, examples, fixtures, documentation, or configuration. Use unmistakable placeholders such as `YOUR_FIREBASE_API_KEY`.
- Never expose secrets in logs, test output, errors, screenshots, generated reports, or commit messages. Redact scanner output.
- Never weaken or remove security checks, Git hooks, CI gates, ignore rules, or Firebase authorization rules to make a build or test pass. Never bypass checks with `--no-verify`, skip variables, or equivalent mechanisms.
- `.gitignore` does not protect files already tracked. Check the Git index as well as untracked files.
- Before finishing a task, inspect the complete Git diff, staged changes, new and renamed files, and relevant tracked-file changes.
- Run `corepack pnpm security:check` after changes and before reporting completion. Report failures or unavailable checks explicitly; do not claim a clean result without evidence.
- If a real credential is found in a commit or Git history, stop and report it without reproducing the value. Recommend revocation or rotation and appropriate history cleanup.
- Treat Firebase web configuration and public OAuth client IDs as public client configuration; authorization must not rely on hiding them. Never expose Firebase Admin credentials, service-account private keys, OAuth client secrets, or user tokens.
- Firebase/Firestore authorization must enforce authenticated ownership using the authenticated UID. Do not introduce public access to user documents or weaken existing rules. Use fake data in tests and examples.
