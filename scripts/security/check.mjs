import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findTrackedSensitivePaths } from "./check-tracked-files.mjs";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scannerVersion = "8.30.1";

function parseArguments(args) {
  let stagedOnly = false;
  let root = scriptRoot;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--staged") stagedOnly = true;
    else if (args[index] === "--repo" && args[index + 1]) root = path.resolve(args[++index]);
    else throw new Error(`Unknown security-check argument: ${args[index]}`);
  }
  return { stagedOnly, root };
}

function runScanner(root, args) {
  const result = spawnSync("gitleaks", args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error?.code === "ENOENT") {
    throw new Error(`Gitleaks ${scannerVersion} is required but was not found on PATH. Install the pinned version using the instructions in README.md.`);
  }
  if (result.error) throw new Error(`Gitleaks could not start: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function gitPaths(root, args) {
  const output = execFileSync("git", args, { cwd: root, encoding: "buffer" });
  return output.toString("utf8").split("\0").filter(Boolean);
}

function scanCurrentChanges(root) {
  const changed = new Set([
    ...gitPaths(root, ["diff", "--no-renames", "--name-only", "--diff-filter=ACMR", "-z", "HEAD"]),
    ...gitPaths(root, ["ls-files", "--others", "--exclude-standard", "-z"])
  ]);
  for (const filePath of changed) {
    const absolutePath = path.resolve(root, filePath);
    if (!existsSync(absolutePath)) continue;
    console.log(`Secret scan: checking working-tree file ${JSON.stringify(filePath)} (values redacted).`);
    runScanner(root, [
      "dir", "--redact=100", "--no-banner", "--config", path.join(scriptRoot, ".gitleaks.toml"), "--", absolutePath
    ]);
  }
}

function checkTrackedPaths(root) {
  const findings = findTrackedSensitivePaths(root);
  if (!findings.length) {
    console.log("Tracked-file policy: passed.");
    return;
  }
  console.error("Tracked-file policy: prohibited sensitive paths are present in the Git index:");
  for (const finding of findings) console.error(`  ${JSON.stringify(finding.path)} (${finding.label})`);
  console.error("Remove the path from the index while keeping any local copy with `git rm --cached -- <path>`, or add a narrowly justified exact-path exception to .security-allowlist.json.");
  process.exit(1);
}

function main() {
  const { stagedOnly, root } = parseArguments(process.argv.slice(2));
  const version = spawnSync("gitleaks", ["version"], { cwd: root, encoding: "utf8", windowsHide: true });
  if (version.error?.code === "ENOENT") {
    throw new Error(`Gitleaks ${scannerVersion} is required but was not found on PATH. Install the pinned version using the instructions in README.md.`);
  }
  if (version.error || version.status !== 0 || !version.stdout.includes(scannerVersion)) {
    throw new Error(`Gitleaks ${scannerVersion} is required. Found: ${(version.stdout ?? "").trim() || "unavailable or failed to run"}.`);
  }

  checkTrackedPaths(root);
  if (!stagedOnly) scanCurrentChanges(root);
  console.log("Secret scan: checking staged index content (values redacted).");
  runScanner(root, [
    "git", "--pre-commit", "--staged", "--redact=100", "--no-banner",
    "--config", path.join(scriptRoot, ".gitleaks.toml")
  ]);
  if (stagedOnly) return;

  console.log("Secret scan: checking all reachable Git history (values redacted).");
  runScanner(root, [
    "git", "--redact=100", "--no-banner", "--config", path.join(scriptRoot, ".gitleaks.toml"),
    "--log-opts=--all"
  ]);
  console.log("Security harness: passed for tracked paths, changed working-tree files, staged content, and all reachable Git history.");
}

try {
  main();
} catch (error) {
  console.error(`Security harness failed: ${error.message}`);
  process.exitCode = 1;
}
