import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const checker = path.join(scriptRoot, "scripts/security/check.mjs");
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "adme-security-harness-"));
const repository = path.join(tempRoot, "fixture repository");
mkdirSync(repository);

function git(args) {
  return execFileSync("git", args, { cwd: repository, stdio: "ignore" });
}

function runCheck(args = [], env = process.env) {
  return spawnSync(process.execPath, [checker, "--repo", repository, ...args], {
    cwd: repository,
    env,
    encoding: "utf8",
    windowsHide: true
  });
}

function expect(label, result, passes) {
  if (passes ? result.status !== 0 : result.status === 0) {
    throw new Error(`${label} did not ${passes ? "pass" : "fail closed as expected"} (exit ${result.status ?? result.error?.code ?? "unknown"}). Scanner output is intentionally suppressed.`);
  }
  console.log(`PASS ${label}`);
}

try {
  git(["init", "--quiet"]);
  git(["config", "user.name", "Security Harness Test"]);
  git(["config", "user.email", "security-harness@example.invalid"]);
  writeFileSync(path.join(repository, ".security-allowlist.json"), '{"exceptions":[]}\n');
  writeFileSync(path.join(repository, ".gitignore"), "");
  writeFileSync(path.join(repository, ".gitleaksignore"), readFileSync(path.join(scriptRoot, ".gitleaksignore")));
  writeFileSync(path.join(repository, "safe-source.js"), "export const sample = 'ordinary source';\n");
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "fixture baseline"]);

  writeFileSync(path.join(repository, "safe-change.js"), "export const changed = true;\n");
  git(["add", "safe-change.js"]);
  expect("normal staged source passes", runCheck(["--staged"]), true);
  git(["reset", "--quiet", "--", "safe-change.js"]);

  const fakeToken = `ghp_${["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6", "Q7R8"].join("")}`;
  writeFileSync(path.join(repository, "fake-secret.txt"), `token = "${fakeToken}"\n`);
  git(["add", "fake-secret.txt"]);
  expect("recognizable fake secret in staged content is rejected", runCheck(["--staged"]), false);
  git(["reset", "--quiet", "--", "fake-secret.txt"]);
  rmSync(path.join(repository, "fake-secret.txt"));

  writeFileSync(path.join(repository, "local notes.sqlite3"), "");
  git(["add", "local notes.sqlite3"]);
  expect("prohibited tracked filename is rejected", runCheck(["--staged"]), false);
  writeFileSync(path.join(repository, ".gitignore"), "*.sqlite3\n");
  git(["add", ".gitignore"]);
  expect("prohibited file stays rejected when ignored after it was tracked", runCheck(["--staged"]), false);
  git(["reset", "--quiet", "--", "local notes.sqlite3", ".gitignore"]);
  rmSync(path.join(repository, "local notes.sqlite3"));

  writeFileSync(path.join(repository, ".env.example"), "PUBLIC_ENDPOINT=YOUR_PUBLIC_ENDPOINT\n");
  git(["add", ".env.example"]);
  expect("sanitized .env.example is allowed", runCheck(["--staged"]), true);

  const exception = {
    exceptions: [{
      path: "fixtures/public-test.pem",
      reason: "An empty fixture verifies the exact-path exception mechanism.",
      reviewedBy: "security harness test"
    }]
  };
  mkdirSync(path.join(repository, "fixtures"));
  writeFileSync(path.join(repository, "fixtures/public-test.pem"), "");
  writeFileSync(path.join(repository, ".security-allowlist.json"), `${JSON.stringify(exception, null, 2)}\n`);
  git(["add", "fixtures/public-test.pem", ".security-allowlist.json"]);
  expect("exact justified false-positive exception is allowed", runCheck(["--staged"]), true);

  const unavailablePath = path.join(tempRoot, "empty-path");
  mkdirSync(unavailablePath);
  expect("missing mandatory scanner fails closed", runCheck(["--staged"], { ...process.env, PATH: unavailablePath }), false);

  expect("full harness scans a clean fixture history", runCheck(), true);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
  console.log("Temporary security fixtures removed.");
}
