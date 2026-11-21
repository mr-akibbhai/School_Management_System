// Checks the exact staged Git blobs; reports locations only, never matched values.
import { execFileSync } from "node:child_process";
const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
const files = git([
  "diff",
  "--cached",
  "--name-only",
  "--diff-filter=ACMR",
  "-z",
])
  .split("\0")
  .filter(Boolean);
const rules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  [
    "GitHub token",
    /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})/,
  ],
  ["Supabase secret key", /sb_secret_[A-Za-z0-9_-]{15,}/],
  [
    "JWT credential",
    /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/,
  ],
  ["AWS access key", /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ["Google API key", /AIza[0-9A-Za-z_-]{30,}/],
  ["credentialed database URL", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/i],
  [
    "literal secret assignment",
    /(?:service_role_key|secret_key|access_token|database_password)\s*[=:]\s*["'][A-Za-z0-9_+\/-]{16,}["']/i,
  ],
];
const findings = [];
for (const file of files) {
  if (
    /(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|id_rsa.*|id_ed25519.*)$/.test(
      file,
    ) &&
    !file.endsWith(".env.example")
  )
    findings.push({ file, rule: "sensitive filename" });
  if (/\.(?:pem|key|p12|pfx|jks|keystore|dump|backup)$/i.test(file))
    findings.push({ file, rule: "credential or database export file" });
  const buffer = execFileSync("git", ["show", `:${file}`], {
    maxBuffer: 20 * 1024 * 1024,
  });
  if (buffer.includes(0)) continue;
  const lines = buffer.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [rule, pattern] of rules)
      if (pattern.test(line)) findings.push({ file, line: index + 1, rule });
  });
}
if (findings.length) {
  console.error(JSON.stringify({ status: "BLOCKED", findings }, null, 2));
  process.exit(1);
}
console.log(
  `PASS: ${files.length} staged files checked for sensitive filenames and credential patterns. No matches. Manual review is still required for context-dependent sensitive data.`,
);
