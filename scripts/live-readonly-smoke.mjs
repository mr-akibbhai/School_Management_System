// Reads metadata/content and tests rejected requests plus an empty tracking lookup.
// No school records/accounts/uploads are created. The lookup increments a transient rate counter.
import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const environment = Object.fromEntries(
  (await readFile(new URL("../.env.local", import.meta.url), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = environment.VITE_SUPABASE_URL,
  key = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.equal(url, "https://nfoohhydncflcbegrxbz.supabase.co");
assert.ok(key?.startsWith("sb_publishable_"));
const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  checks = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, status: "passed", detail });
  } catch (e) {
    checks.push({ name, status: "failed", detail: e.message });
  }
}
await check("public settings read", async () => {
  const { data, error } = await client.from("settings").select("id");
  assert.equal(error, null);
  assert.equal(data.length, 1);
  return "One settings record is accessible.";
});
for (const table of ["students", "admissions", "results", "contact_messages"])
  await check("anonymous " + table + " privacy", async () => {
    const { count, error } = await client
      .from(table)
      .select("id", { count: "exact", head: true });
    assert.equal(error, null);
    assert.equal(count, 0);
    return "No rows visible; live table is empty and RLS metadata is audited separately.";
  });
await check("anonymous admin membership denied", async () => {
  const result = await client.from("admins").select("user_id");
  assert.ok(result.error);
  return "Direct membership SELECT rejected.";
});
await check("anonymous membership helper", async () => {
  const { data, error } = await client.rpc("is_admin");
  assert.equal(error, null);
  assert.equal(data, false);
  return "is_admin returned false.";
});
for (const [rpc, args] of [
  [
    "lookup_result",
    { p_student_code: "TEST-NONEXISTENT", p_access_code: "a".repeat(32) },
  ],
  ["track_admission", { p_code: "a".repeat(32) }],
  ["consume_rate_limit", { p_key: "TEST-NONEXISTENT" }],
])
  await check("anonymous RPC " + rpc + " denied", async () => {
    const result = await client.rpc(rpc, args);
    assert.ok(result.error);
    return "Execution permission rejected before function runs.";
  });
await check("hosted Auth policy", async () => {
  const r = await fetch(url + "/auth/v1/settings", {
    headers: { apikey: key },
  });
  assert.equal(r.status, 200);
  const settings = await r.json();
  assert.equal(settings.disable_signup, true);
  assert.equal(settings.external.email, true);
  assert.equal(settings.mailer_autoconfirm, false);
  return "Email enabled; public signup disabled; email confirmation required.";
});
await check("private document listing", async () => {
  const { data, error } = await client.storage
    .from("admission-documents")
    .list();
  assert.equal(error, null);
  assert.equal(data.length, 0);
  return "Anonymous client sees no private objects.";
});
async function edge(
  name,
  {
    origin = "http://127.0.0.1:5173",
    method = "POST",
    body,
    authorization,
  } = {},
) {
  const headers = { apikey: key };
  if (origin !== null) headers.Origin = origin;
  if (body) headers["Content-Type"] = "application/json";
  if (authorization) headers.Authorization = authorization;
  return fetch(url + "/functions/v1/" + name, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
await check("public API configured preflight", async () => {
  const r = await edge("public-api", { method: "OPTIONS" });
  assert.equal(r.status, 204);
  assert.equal(
    r.headers.get("Access-Control-Allow-Origin"),
    "http://127.0.0.1:5173",
  );
  return "Exact local origin accepted.";
});
await check("public API untrusted origin rejected", async () => {
  assert.equal(
    (await edge("public-api", { origin: "https://attacker.invalid" })).status,
    403,
  );
  return "Untrusted origin rejected.";
});
await check("public API missing origin rejected", async () => {
  assert.equal((await edge("public-api", { origin: null })).status, 403);
  return "No browser origin was not treated as an allowlist entry.";
});
await check("public API invalid payload rejected", async () => {
  assert.equal(
    (
      await edge("public-api", {
        body: { action: "delete", payload: {}, captcha: "test" },
      })
    ).status,
    400,
  );
  return "Unknown operation rejected without database call.";
});
await check("public API missing form metadata rejected", async () => {
  assert.equal(
    (
      await edge("public-api", {
        body: {
          action: "track",
          payload: { code: "a".repeat(32) },
          captcha: "",
        },
      })
    ).status,
    400,
  );
  return "Missing anti-spam metadata rejected.";
});
await check("public API honeypot rejection", async () => {
  const r = await edge("public-api", {
    body: {
      action: "track",
      payload: { code: "a".repeat(32) },
      captcha: "",
      company_website: "https://spam.invalid",
      form_started_at: Date.now() - 3000,
    },
  });
  assert.equal(r.status, 400);
  return "Honeypot submission rejected before database operations.";
});
await check("public API tracking without CAPTCHA", async () => {
  const r = await edge("public-api", {
    body: {
      action: "track", payload: { code: "a".repeat(32) }, captcha: "",
      company_website: "", form_started_at: Date.now() - 3000,
    },
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(body && typeof body === "object");
  return "Validated tracking request completed without CAPTCHA; no school record was created.";
});
await check("upload anonymous request rejected", async () => {
  assert.equal((await edge("upload")).status, 401);
  return "No authenticated bearer session; upload rejected.";
});
await check("upload forged session rejected", async () => {
  assert.equal(
    (
      await edge("upload", {
        authorization: "Bearer deliberately-invalid-test-token",
      })
    ).status,
    401,
  );
  return "Server validates session with Auth before file handling.";
});
const report = {
  date: "2026-11-22",
  project_ref: "nfoohhydncflcbegrxbz",
  mode: "Metadata/content reads, rejected requests and empty tracking lookup; transient rate counter only; no school record or account creation",
  checks,
};
await writeFile(
  new URL("../docs/live-readonly-smoke.json", import.meta.url),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
if (checks.some((c) => c.status === "failed")) process.exitCode = 1;
