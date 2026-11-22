import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = env.VITE_SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url, "https://nfoohhydncflcbegrxbz.supabase.co");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checks = [];
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, status: "passed" });
  } catch (e) {
    checks.push({ name, status: "failed", reason: e.message });
  }
}
for (const table of [
  "teacher_accounts",
  "teacher_assignments",
  "admin_invitations",
  "secondary_admins",
  "enrollments",
  "subject_marks",
  "mark_submissions",
  "mark_history",
  "result_sheets",
  "student_details",
  "teacher_attendance",
  "class_attendance",
])
  await check("anonymous " + table + " denied", async () => {
    const r = await client.from(table).select("*");
    assert.ok(r.error || r.data.length === 0);
  });
for (const [name, args] of [
  ["school_role", {}],
  ["class_roster", { p_class: "00000000-0000-4000-8000-000000000001" }],
  ["accept_admin_invitation", {}],
  ["reserve_admin_invitation", { p_email: "not-sent@example.test" }],
  [
    "save_marks",
    {
      p_exam_subject: "00000000-0000-4000-8000-000000000001",
      p_rows: [],
      p_submit: false,
    },
  ],
  [
    "calculate_exam_results",
    { p_exam: "00000000-0000-4000-8000-000000000001" },
  ],
])
  await check("anonymous RPC " + name + " denied", async () =>
    assert.ok((await client.rpc(name, args)).error),
  );
await check(
  "public academic catalog accessible and restricted to non-personal fields",
  async () => {
    const r = await client.rpc("public_academic_catalog");
    assert.equal(r.error, null);
    for (const row of r.data)
      assert.deepEqual(
        Object.keys(row).sort(),
        [
          "academic_year",
          "class_name_bn",
          "class_name_en",
          "level",
          "section",
          "subject_name_bn",
          "subject_name_en",
        ].sort(),
      );
  },
);
for (const origin of [
  "http://127.0.0.1:5173",
  "https://rabeya-wahed-biddaniketan.vercel.app",
])
  await check("function preflight " + origin, async () => {
    const r = await fetch(url + "/functions/v1/school-accounts", {
      method: "OPTIONS",
      headers: { Origin: origin, apikey: key },
    });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), origin);
  });
async function accounts(body) {
  return fetch(url + "/functions/v1/school-accounts", {
    method: "POST",
    headers: {
      Origin: "https://rabeya-wahed-biddaniketan.vercel.app",
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
await check("public cannot invite secondary Admin", async () =>
  assert.equal(
    (await accounts({ action: "invite_admin", email: "not-sent@example.test" }))
      .status,
    401,
  ),
);
await check("teacher registration honeypot rejected", async () =>
  assert.equal(
    (
      await accounts({
        action: "register_teacher",
        email: "not-sent@example.test",
        profile: {
          full_name: "Synthetic Teacher",
          phone: "01700000000",
          designation: "Teacher",
        },
        company_website: "spam",
        form_started_at: Date.now() - 3000,
      })
    ).status,
    400,
  ),
);
await check(
  "teacher email remains gated without creating account",
  async () => {
    const r = await accounts({
      action: "register_teacher",
      email: "not-sent@example.test",
      profile: {
        full_name: "Synthetic Teacher",
        phone: "01700000000",
        designation: "Teacher",
      },
      company_website: "",
      form_started_at: Date.now() - 3000,
    });
    assert.equal(r.status, 503);
    assert.match((await r.json()).error, /SMTP/);
  },
);
for (const bucket of ["teacher-private", "student-photos"])
  await check("private " + bucket + " inaccessible anonymously", async () => {
    const r = await client.storage.from(bucket).list();
    assert.ok(r.error || r.data.length === 0);
  });
const report = {
  date: "2026-11-22",
  project_ref: "nfoohhydncflcbegrxbz",
  scope:
    "Live anonymous reads, rejected operations and SMTP gate; rate counter only; no school records or Auth accounts created",
  checks,
};
await writeFile(
  "docs/live-upgrade-smoke.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    {
      passed: checks.filter((c) => c.status === "passed").length,
      total: checks.length,
      failures: checks.filter((c) => c.status === "failed"),
    },
    null,
    2,
  ),
);
if (checks.some((c) => c.status === "failed")) process.exitCode = 1;
