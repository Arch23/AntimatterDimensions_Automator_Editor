import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const prohibitedPatterns = [
  { label: "environment file", pattern: /(^|\/)\.env(?:\..*)?$/i },
  { label: "service account credentials", pattern: /(^|\/)[^/]*service-account[^/]*\.json$/i },
  { label: "Firebase Admin credentials", pattern: /(^|\/)[^/]*firebase-adminsdk[^/]*\.json$/i },
  { label: "OAuth client secret", pattern: /(^|\/)client_secret[^/]*\.json$/i },
  { label: "private key or certificate", pattern: /\.(?:pem|key|p12|pfx)$/i },
  { label: "local database", pattern: /\.(?:sqlite|sqlite3|db)(?:-(?:shm|wal|journal))?$/i },
  { label: "backup or credential export", pattern: /(?:\.bak|\.backup|\.old|\.orig|\.dump|~)$/i },
  { label: "local application data", pattern: /(^|\/)(?:\.?local-data|user-data|userdata|app-data|application-data|credential-exports|backups?)(?:\/|$)/i }
];

function loadExceptions(root = repositoryRoot) {
  let parsed;
  try {
    let contents;
    try {
      execFileSync("git", ["ls-files", "--error-unmatch", "--", ".security-allowlist.json"], { cwd: root, stdio: "ignore" });
      contents = execFileSync("git", ["show", ":.security-allowlist.json"], { cwd: root, encoding: "utf8" });
    } catch {
      contents = readFileSync(path.join(root, ".security-allowlist.json"), "utf8");
    }
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Cannot read .security-allowlist.json: ${error.message}`);
  }
  if (!parsed || !Array.isArray(parsed.exceptions)) {
    throw new Error(".security-allowlist.json must contain an exceptions array.");
  }
  for (const exception of parsed.exceptions) {
    if (!exception || typeof exception.path !== "string" || !exception.path ||
        typeof exception.reason !== "string" || exception.reason.trim().length < 12 ||
        typeof exception.reviewedBy !== "string" || !exception.reviewedBy.trim() ||
        exception.path.includes("*") || exception.path.includes("?") || exception.path.includes("..")) {
      throw new Error("Each sensitive-file exception needs one exact path, a specific reason, and a reviewer; wildcards are not allowed.");
    }
  }
  return new Set(parsed.exceptions.map(exception => exception.path.replaceAll("\\", "/")));
}

export function findTrackedSensitivePaths(root = repositoryRoot) {
  const raw = execFileSync("git", ["ls-files", "--cached", "-z"], { cwd: root, encoding: "buffer" });
  const paths = raw.toString("utf8").split("\0").filter(Boolean);
  const exceptions = loadExceptions(root);
  return paths.flatMap(filePath => {
    const normalized = filePath.replaceAll("\\", "/");
    const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
    // Sanitized example templates remain visible to secret scanning.
    if (basename.toLowerCase() === ".env.example") return [];
    if (exceptions.has(normalized)) return [];
    const finding = prohibitedPatterns.find(item => item.pattern.test(normalized));
    return finding ? [{ path: normalized, label: finding.label }] : [];
  });
}

function main() {
  const findings = findTrackedSensitivePaths(repositoryRoot);
  if (findings.length === 0) {
    console.log("Tracked-file policy: passed.");
    return;
  }
  console.error("Tracked-file policy: prohibited sensitive paths are present in the Git index:");
  for (const finding of findings) console.error(`  ${JSON.stringify(finding.path)} (${finding.label})`);
  console.error("Remove the path from the index while keeping any local copy with `git rm --cached -- <path>`, or add a narrowly justified exact-path exception to .security-allowlist.json.");
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
