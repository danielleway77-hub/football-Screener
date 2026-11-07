// Fails when a tracked file contains something that looks like a real secret (Step 16.1).
// Usage: node scripts/secret-scan.mjs   (also imported by tests/unit/secret-scan.test.ts)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Each pattern has a name and a RegExp; placeholders are excluded by `isPlaceholder`. */
export const PATTERNS = [
  [
    "database URL with a password",
    /postgres(?:ql)?:\/\/[^\s"'`<>:@/]+:([^\s"'`<>@]+)@[^\s"'`<>/]+/g,
  ],
  ["bcrypt hash", /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{50,}/g],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["Stripe/OpenAI-style secret key", /\b(?:sk_live|sk-proj|sk-ant)[-_][A-Za-z0-9_-]{16,}/g],
  ["Neon password", /\bnpg_[A-Za-z0-9]{8,}\b/g],
  ["app ingest token", /\bscr_[A-Za-z0-9_-]{43}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}\b/g],
  [
    "secret assignment with a long literal",
    /\b(?:SESSION_SECRET|CRON_SECRET|PROVIDER_API_KEY|APP_PASSWORD_HASH|E2E_PASSWORD)\s*[:=]\s*["']?([A-Za-z0-9+/_-]{24,})["']?/g,
  ],
];

const PLACEHOLDER =
  /^(?:u|p|user|pass|password|test|x+|a+|s+|c+|changeme|your[-_a-z]*|<.*>|\.{3}|\$\{.*\})$/i;

/** True for obviously fake values used in docs/tests (user:pass, "s".repeat(40), <hash>...). */
export function isPlaceholder(value) {
  return !value || PLACEHOLDER.test(value) || /^(.)\1{11,}$/.test(value);
}

/** Returns [{name, match}] findings for one text. */
export function scanText(text) {
  const findings = [];
  for (const [name, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const captured = m[1];
      if (captured !== undefined && isPlaceholder(captured)) continue;
      findings.push({ name, match: m[0].slice(0, 60) });
    }
  }
  return findings;
}

export function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean)
    .filter((f) => !/\.(png|jpe?g|webp|ico|woff2?|pdf|zip|lock)$|pnpm-lock\.yaml$/i.test(f));
}

export function scanRepo() {
  const out = [];
  for (const file of trackedFiles()) {
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\u0000")) continue;
    for (const f of scanText(text)) out.push({ file, ...f });
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = scanRepo();
  for (const f of found) console.error(`${f.file}: ${f.name}: ${f.match}`);
  console.log(
    found.length ? `secret scan FAILED: ${found.length} finding(s)` : "secret scan clean",
  );
  process.exit(found.length ? 1 : 0);
}
