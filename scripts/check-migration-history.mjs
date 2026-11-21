// Receives the non-secret remote migration metadata on stdin; never executes SQL.
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const remote = JSON.parse(input).migrations;
const folder = new URL("../supabase/migrations/", import.meta.url);
const files = (await readdir(folder)).filter((f) => f.endsWith(".sql")).sort();
const local = files.map((file) => {
  const m = file.match(/^(\d+)_(.+)\.sql$/);
  if (!m) throw new Error("Invalid migration filename: " + file);
  return { version: m[1], name: m[2], file };
});
if (
  JSON.stringify(local.map(({ version, name }) => ({ version, name }))) !==
  JSON.stringify(remote.map(({ version, name }) => ({ version, name })))
)
  throw new Error(
    "Local/remote migration history differs. Do not push migrations.",
  );
const evidence = JSON.parse(
  await readFile(
    new URL("../docs/database-setup-evidence.json", import.meta.url),
    "utf8",
  ),
);
for (const applied of evidence.migrations) {
  const file = local.find((m) => m.version === applied.applied_version);
  if (!file) throw new Error("Missing applied migration");
  const text = (await readFile(new URL(file.file, folder), "utf8")).replaceAll(
    "\r\n",
    "\n",
  );
  if (createHash("sha256").update(text).digest("hex") !== applied.source_sha256)
    throw new Error("Previously applied SQL changed: " + file.file);
}
console.log(
  `PASS: ${local.length} local migration versions/names match remote; all original migration SQL hashes are unchanged.`,
);
