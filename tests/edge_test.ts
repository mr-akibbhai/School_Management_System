import { createPublicHandler } from "../supabase/functions/public-api/handler.ts";
import { createUploadHandler } from "../supabase/functions/upload/handler.ts";
const equal = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(
      `Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`,
    );
};
const config: Record<string, string> = {
  ALLOWED_ORIGINS: "http://localhost:5173",
  TURNSTILE_HOSTNAMES: "localhost",
  TURNSTILE_SECRET_KEY: "test-only",
  RATE_LIMIT_SALT: "test-only",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only",
  SUPABASE_ANON_KEY: "test-only",
};
function publicFixture(overrides: Record<string, string> = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let accepted = true,
    captcha = true,
    hostname = "localhost";
  const handler = createPublicHandler({
    env: (name) => ({ ...config, ...overrides })[name],
    client: () => ({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return {
          data:
            name === "consume_rate_limit" ? accepted : { status: "pending" },
          error: null,
        };
      },
      from: () => ({
        insert: async () => {
          calls.push({ name: "insert", args: {} });
          return { error: null };
        },
      }),
    }),
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify({ success: captcha, hostname })),
      ),
  });
  return {
    handler,
    calls,
    limit: (v: boolean) => (accepted = v),
    captcha: (v: boolean) => (captcha = v),
    hostname: (v: string) => (hostname = v),
  };
}
function jsonRequest(body: unknown, origin = "http://localhost:5173") {
  return new Request("https://example.supabase.co/functions/v1/public-api", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      company_website: "",
      form_started_at: Date.now() - 3000,
      ...(body as Record<string, unknown>),
    }),
  });
}
const tracking = {
  action: "track",
  payload: { code: "a".repeat(32) },
  captcha: "test-response",
};
Deno.test(
  "public: denies missing/untrusted origins and preflights",
  async () => {
    const f = publicFixture();
    for (const origin of ["", "https://attacker.invalid"]) {
      equal((await f.handler(jsonRequest(tracking, origin))).status, 403);
      equal(
        (
          await f.handler(
            new Request("https://example.com", {
              method: "OPTIONS",
              headers: { origin },
            }),
          )
        ).status,
        403,
      );
    }
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "public: permits configured preflight without database access",
  async () => {
    const f = publicFixture();
    const r = await f.handler(
      new Request("https://example.com", {
        method: "OPTIONS",
        headers: { origin: "http://localhost:5173" },
      }),
    );
    equal(r.status, 204);
    equal(
      r.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:5173",
    );
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "public: rejects invalid actions, fields and consent before database",
  async () => {
    const f = publicFixture();
    for (const body of [
      { ...tracking, action: "delete" },
      { ...tracking, payload: { code: "bad" } },
      { action: "admission", payload: { consent: false }, captcha: "test" },
    ])
      equal((await f.handler(jsonRequest(body))).status, 400);
    equal(f.calls.length, 0);
  },
);
Deno.test("public: enforces bounded bodies", async () => {
  const f = publicFixture();
  equal(
    (await f.handler(jsonRequest({ ...tracking, padding: "x".repeat(17000) })))
      .status,
    413,
  );
  equal(f.calls.length, 0);
});
Deno.test("public: fails closed without required configuration", async () => {
  const f = publicFixture({ TURNSTILE_SECRET_KEY: "" });
  equal((await f.handler(jsonRequest(tracking))).status, 503);
  equal(f.calls.length, 0);
});
Deno.test(
  "public: rejects captcha failure and wrong hostname before database",
  async () => {
    const f = publicFixture();
    f.captcha(false);
    equal((await f.handler(jsonRequest(tracking))).status, 400);
    f.captcha(true);
    f.hostname("attacker.invalid");
    equal((await f.handler(jsonRequest(tracking))).status, 403);
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "public: rate limit uses a hash and stops exhausted requests",
  async () => {
    const f = publicFixture();
    f.limit(false);
    equal((await f.handler(jsonRequest(tracking))).status, 429);
    equal(
      f.calls.map((c) => c.name),
      ["consume_rate_limit"],
    );
    equal(String(f.calls[0].args.p_key).length, 64);
  },
);
Deno.test(
  "public: exact tracking lookup follows captcha and rate checks",
  async () => {
    const f = publicFixture();
    equal((await f.handler(jsonRequest(tracking))).status, 200);
    equal(
      f.calls.map((c) => c.name),
      ["consume_rate_limit", "track_admission"],
    );
    equal(f.calls[1].args, { p_code: "a".repeat(32) });
  },
);
Deno.test(
  "public: optional CAPTCHA still enforces database rate limiting",
  async () => {
    const f = publicFixture({
      CAPTCHA_MODE: "disabled",
      TURNSTILE_SECRET_KEY: "",
      TURNSTILE_HOSTNAMES: "",
    });
    f.captcha(false);
    equal(
      (await f.handler(jsonRequest({ ...tracking, captcha: "" }))).status,
      200,
    );
    equal(
      f.calls.map((c) => c.name),
      ["consume_rate_limit", "track_admission"],
    );
    f.limit(false);
    equal(
      (await f.handler(jsonRequest({ ...tracking, captcha: "" }))).status,
      429,
    );
  },
);
Deno.test(
  "public: rejects honeypot submissions without a database call",
  async () => {
    const f = publicFixture({ CAPTCHA_MODE: "disabled" });
    equal(
      (
        await f.handler(
          jsonRequest({ ...tracking, company_website: "https://spam.invalid" }),
        )
      ).status,
      400,
    );
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "public: rejects rushed, expired and future form timestamps",
  async () => {
    const f = publicFixture({ CAPTCHA_MODE: "disabled" });
    for (const form_started_at of [
      Date.now(),
      Date.now() + 100000,
      Date.now() - 3 * 60 * 60 * 1000,
    ])
      equal(
        (await f.handler(jsonRequest({ ...tracking, form_started_at }))).status,
        400,
      );
    equal(f.calls.length, 0);
  },
);
Deno.test("public: client cannot disable server-required CAPTCHA", async () => {
  const f = publicFixture();
  f.captcha(false);
  equal(
    (await f.handler(jsonRequest({ ...tracking, CAPTCHA_MODE: "disabled" })))
      .status,
    400,
  );
  equal(f.calls.length, 0);
});
Deno.test("public: result lookup sends only expected identifiers", async () => {
  const f = publicFixture();
  equal(
    (
      await f.handler(
        jsonRequest({
          action: "result",
          payload: { student_code: "TEST-ID", access_code: "b".repeat(32) },
          captcha: "test",
        }),
      )
    ).status,
    200,
  );
  equal(f.calls[1], {
    name: "lookup_result",
    args: { p_student_code: "TEST-ID", p_access_code: "b".repeat(32) },
  });
});
function uploadFixture() {
  let valid = true,
    admin = true,
    role = "none";
  const uploads: { bucket: string; path: string }[] = [];
  const handler = createUploadHandler({
    env: (name) => config[name],
    client: () => ({
      auth: {
        getUser: async () => ({
          data: { user: valid ? { id: "test-admin" } : null },
          error: null,
        }),
      },
      rpc: async (name) => ({
        data: name === "school_role" ? role : admin,
        error: null,
      }),
      storage: {
        from: (bucket) => ({
          upload: async (path) => {
            uploads.push({ bucket, path });
            return { error: null };
          },
          getPublicUrl: (path) => ({
            data: { publicUrl: "https://example.invalid/" + path },
          }),
        }),
      },
    }),
  });
  return {
    handler,
    uploads,
    valid: (v: boolean) => (valid = v),
    admin: (v: boolean) => (admin = v),
    role: (v: string) => (role = v),
  };
}
function fileRequest(
  bucket = "admission-documents",
  type = "application/pdf",
  contents = new TextEncoder().encode("%PDF-1.7\nSynthetic test only"),
) {
  const form = new FormData();
  form.append("bucket", bucket);
  form.append("file", new File([contents], "test.pdf", { type }));
  return new Request("https://example.supabase.co/functions/v1/upload", {
    method: "POST",
    headers: {
      origin: "http://localhost:5173",
      Authorization: "Bearer test-session",
    },
    body: form,
  });
}
Deno.test(
  "upload: rejects anonymous, invalid-session and non-admin callers",
  async () => {
    const f = uploadFixture();
    equal(
      (
        await f.handler(
          new Request("https://example.com", {
            method: "POST",
            headers: { origin: "http://localhost:5173" },
          }),
        )
      ).status,
      401,
    );
    f.valid(false);
    equal((await f.handler(fileRequest())).status, 401);
    f.valid(true);
    f.admin(false);
    equal((await f.handler(fileRequest())).status, 403);
    equal(f.uploads.length, 0);
  },
);
Deno.test(
  "upload: private document returns path without public URL",
  async () => {
    const f = uploadFixture();
    const r = await f.handler(fileRequest());
    equal(r.status, 200);
    const body = await r.json();
    equal(body.url, null);
    equal(body.path.startsWith("test-admin/"), true);
    equal(f.uploads.length, 1);
  },
);
Deno.test(
  "upload: rejects wrong buckets, mismatched contents and forbidden types",
  async () => {
    const f = uploadFixture();
    for (const req of [
      fileRequest("unknown"),
      fileRequest("branding"),
      fileRequest("admission-documents", "image/png"),
      fileRequest(
        "branding",
        "image/svg+xml",
        new TextEncoder().encode("<svg/>"),
      ),
    ])
      equal((await f.handler(req)).status, 400);
    equal(f.uploads.length, 0);
  },
);
Deno.test(
  "upload: rejects empty and oversized files before storage",
  async () => {
    const f = uploadFixture();
    equal(
      (
        await f.handler(
          fileRequest(
            "admission-documents",
            "application/pdf",
            new Uint8Array(),
          ),
        )
      ).status,
      400,
    );
    const oversize = new Uint8Array(11 * 1024 * 1024);
    oversize.set(new TextEncoder().encode("%PDF-"));
    equal(
      (
        await f.handler(
          fileRequest("admission-documents", "application/pdf", oversize),
        )
      ).status,
      400,
    );
    equal(f.uploads.length, 0);
  },
);

Deno.test(
  "upload: teacher can upload own private photograph but no public or student files",
  async () => {
    const f = uploadFixture();
    f.admin(false);
    f.role("pending");
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const r = await f.handler(fileRequest("teacher-private", "image/png", png));
    equal(r.status, 200);
    equal((await r.json()).url, null);
    equal(
      (await f.handler(fileRequest("student-photos", "image/png", png))).status,
      403,
    );
    equal(
      (await f.handler(fileRequest("branding", "image/png", png))).status,
      403,
    );
  },
);
Deno.test(
  "upload: student photographs remain private even for Admin",
  async () => {
    const f = uploadFixture();
    const r = await f.handler(
      fileRequest(
        "student-photos",
        "image/png",
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    );
    equal(r.status, 200);
    equal((await r.json()).url, null);
  },
);
