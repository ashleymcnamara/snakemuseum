// Submission validator for the Snake Museum.
//
// For each changed game folder it checks:
//   (a) required files present  (index.html, meta.json, thumbnail.png)
//   (b) meta.json matches games/schema.json
//   (c) only allowed file extensions are used
//   (d) the folder stays under the size cap
//   (e) .html / .js contain no dangerous / untrusted-network patterns
//
// Runnable locally and in CI (zero dependencies):
//   node scripts/validate-submission.js                 # CI: changed folders, else all
//   node scripts/validate-submission.js classic-snake   # a slug
//   node scripts/validate-submission.js games/classic-snake ...
//
// Exits non-zero (failing the PR check) with an itemized report of every reason.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validate, loadJson } from "./lib/schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gamesDir = path.join(repoRoot, "games");
const schemaPath = path.join(gamesDir, "schema.json");

const REQUIRED_FILES = ["index.html", "meta.json", "thumbnail.png"];
const ALLOWED_EXT = new Set([
  ".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".md",
]);
const SIZE_CAP_BYTES = 2 * 1024 * 1024; // 2 MB
const SCAN_EXT = new Set([".html", ".js"]);

// Dangerous patterns. Each fails the submission with a clear reason.
const DANGER = [
  { label: "network: fetch()", re: /\bfetch\s*\(/ },
  { label: "network: XMLHttpRequest", re: /\bXMLHttpRequest\b/ },
  { label: "network: WebSocket", re: /\bWebSocket\b/ },
  { label: "network: navigator.sendBeacon", re: /\bnavigator\s*\.\s*sendBeacon\b/ },
  { label: 'external <script src="http…">', re: /<script\b[^>]*\bsrc\s*=\s*["']?\s*(?:https?:)?\/\//i },
  { label: "external @import url(http…)", re: /@import\s+(?:url\(\s*)?["']?\s*(?:https?:)?\/\//i },
  { label: "dynamic code: eval()", re: /\beval\s*\(/ },
  { label: "dynamic code: new Function()", re: /\bnew\s+Function\s*\(/ },
  { label: "cookie access: document.cookie", re: /\bdocument\s*\.\s*cookie\b/ },
  { label: "document.write()", re: /\bdocument\s*\.\s*write(?:ln)?\s*\(/ },
  { label: "frame escape: window.top", re: /\bwindow\s*\.\s*top\b/ },
  { label: "frame escape: window.parent", re: /\bwindow\s*\.\s*parent\b/ },
  { label: "frame escape: parent.<...>", re: /(?<![\w.$])parent\s*\.\s*[A-Za-z_$]/ },
  { label: "nested <iframe>", re: /<iframe\b/i },
  { label: "nested <object>", re: /<object\b/i },
  { label: "nested <embed>", re: /<embed\b/i },
  { label: "long base64 blob (possible hidden payload)", re: /[A-Za-z0-9+/]{500,}={0,2}/ },
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function humanMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ---- target selection ------------------------------------------------------
function changedSlugsFromGit() {
  const base = process.env.GITHUB_BASE_REF;
  if (!base) return null;
  const refsToTry = [`origin/${base}`, base];
  try {
    execSync(`git fetch --no-tags --depth=1 origin ${base}`, { stdio: "ignore", cwd: repoRoot });
  } catch {
    /* best effort; checkout may already have it */
  }
  for (const ref of refsToTry) {
    try {
      const out = execSync(`git diff --name-only ${ref}...HEAD`, { encoding: "utf8", cwd: repoRoot });
      const slugs = new Set();
      for (const line of out.split("\n")) {
        const m = line.match(/^games\/([^/]+)\//);
        if (m) slugs.add(m[1]);
      }
      return [...slugs];
    } catch {
      /* try next ref */
    }
  }
  return null;
}

function allSlugs() {
  return fs
    .readdirSync(gamesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function resolveTarget(arg) {
  const candidates = [path.join(gamesDir, arg), path.resolve(repoRoot, arg), path.resolve(arg)];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return c;
  }
  return path.join(gamesDir, arg); // report as missing later
}

function selectTargets() {
  const args = process.argv.slice(2);
  if (args.length) return args.map(resolveTarget);

  const changed = changedSlugsFromGit();
  if (changed !== null) {
    if (changed.length === 0) return []; // PR didn't touch any game folder
    return changed.map((s) => path.join(gamesDir, s));
  }
  return allSlugs().map((s) => path.join(gamesDir, s)); // local fallback: everything
}

// ---- per-folder checks -----------------------------------------------------
function validateFolder(dir) {
  const slug = path.basename(dir);
  const rel = "games/" + slug;
  const errors = [];

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { rel, errors: [`folder ${rel} does not exist`] };
  }

  // (a) required files
  for (const f of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(dir, f))) errors.push(`missing required file: ${f}`);
  }

  // (b) meta.json against schema
  const metaPath = path.join(dir, "meta.json");
  if (fs.existsSync(metaPath)) {
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    } catch (e) {
      errors.push(`meta.json is not valid JSON: ${e.message}`);
    }
    if (meta) {
      const schema = loadJson(schemaPath);
      const { valid, errors: schemaErrors } = validate(meta, schema);
      if (!valid) for (const se of schemaErrors) errors.push(`meta.json ${se}`);
    }
  }

  const files = walk(dir);

  // (c) extension allowlist
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      errors.push(`disallowed file type: ${path.relative(dir, f)} (${ext || "no extension"})`);
    }
  }

  // (d) size cap
  const totalBytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  if (totalBytes > SIZE_CAP_BYTES) {
    errors.push(`folder is ${humanMB(totalBytes)}, exceeds the ${humanMB(SIZE_CAP_BYTES)} cap`);
  }

  // (e) dangerous-pattern scan of .html / .js
  for (const f of files) {
    if (!SCAN_EXT.has(path.extname(f).toLowerCase())) continue;
    const relFile = path.relative(dir, f);
    const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { label, re } of DANGER) {
        if (re.test(line)) {
          const snippet = line.trim().slice(0, 80);
          errors.push(`${relFile}:${i + 1} - ${label}  ->  ${snippet}`);
        }
      }
    });
  }

  return { rel, errors };
}

// ---- reporting -------------------------------------------------------------
function main() {
  const targets = selectTargets();

  if (targets.length === 0) {
    console.log("No game folders changed - nothing to validate.");
    return;
  }

  console.log(`Validating ${targets.length} submission(s):\n`);
  const results = targets.map(validateFolder);

  const summary = ["# Snake Museum submission check\n"];
  let failed = 0;

  for (const { rel, errors } of results) {
    if (errors.length === 0) {
      console.log(`PASS  ${rel} - all checks passed`);
      summary.push(`- **PASS** \`${rel}\` - all checks passed`);
    } else {
      failed++;
      console.log(`\nFAIL  ${rel} - ${errors.length} problem(s):`);
      for (const e of errors) console.log(`    - ${e}`);
      summary.push(`- **FAIL** \`${rel}\` - ${errors.length} problem(s):`);
      for (const e of errors) summary.push(`  - ${e}`);
    }
  }

  // Post a job summary when running in GitHub Actions.
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
    } catch {
      /* non-fatal */
    }
  }

  if (failed > 0) {
    console.log(`\nFAIL  ${failed} submission(s) failed validation. See reasons above.`);
    process.exit(1);
  }
  console.log(`\nPASS  All ${results.length} submission(s) passed.`);
}

main();
