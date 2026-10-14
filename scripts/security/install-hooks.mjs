import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const hooksPath = execFileSync("git", ["rev-parse", "--git-path", "hooks"], { cwd: root, encoding: "utf8" }).trim();
const hookDirectory = path.resolve(root, hooksPath);
const hooks = {
  "pre-commit": ["--staged"],
  "pre-push": []
};

const plannedHooks = Object.entries(hooks).map(([name, args]) => {
  const destination = path.join(hookDirectory, name);
  const existing = existsSync(destination) ? readFileSync(destination, "utf8") : "";
  const argsText = args.map(value => ` '${value}'`).join("");
  const content = `#!/bin/sh\n# adme-security-harness\nrepo_root=$(git rev-parse --show-toplevel) || exit 1\ncd "$repo_root" || exit 1\nexec node scripts/security/check.mjs${argsText}\n`;
  if (existing && existing !== content) {
    throw new Error(`Refusing to overwrite a different ${name} hook at ${destination}. Merge the security command into that hook manually.`);
  }
  return { name, destination, content };
});

for (const { name, destination, content } of plannedHooks) {
  writeFileSync(destination, content, { mode: 0o755 });
  if (process.platform !== "win32") chmodSync(destination, 0o755);
  console.log(`Installed ${name} security check.`);
}

console.log("Git hooks are installed for this clone. Run `corepack pnpm security:install-hooks` again after cloning or resetting local Git metadata.");
