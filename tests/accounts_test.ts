import { createAccountsHandler } from "../supabase/functions/school-accounts/handler.ts";
const equal = (a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`);
};
const base: Record<string, string> = {
  ALLOWED_ORIGINS: "http://localhost:5173",
  SUPABASE_SERVICE_ROLE_KEY: "test-only",
  SUPABASE_ANON_KEY: "public-test",
  RATE_LIMIT_SALT: "test-only",
  CAPTCHA_MODE: "disabled",
  SCHOOL_EMAIL_ENABLED: "true",
};
const payload = {
  action: "register_teacher",
  email: "fixture@example.test",
  profile: {
    full_name: "Fixture Teacher",
    phone: "01700000000",
    designation: "Teacher",
  },
  company_website: "",
  form_started_at: Date.now() - 3000,
};
function fixture(overrides: Record<string, string> = {}) {
  const calls: { name: string; args: any }[] = [];
  let isOwner = true,
    rate = true,
    authValid = true,
    inviteError = false,
    reserveError = false;
  const handler = createAccountsHandler({
    env: (k) => ({ ...base, ...overrides })[k],
    client: (_key, authorization) => ({
      auth: {
        getUser: async () => ({
          data: { user: authValid ? { id: "fixture-user" } : null },
          error: authValid ? null : true,
        }),
        admin: {
          inviteUserByEmail: async (email: string, args: unknown) => {
            calls.push({
              name: "invite",
              args: { email, ...(args as object) },
            });
            return {
              data: { user: inviteError ? null : { id: "invited-user" } },
              error: inviteError ? true : null,
            };
          },
        },
      },
      rpc: async (name: string, args: any) => {
        calls.push({ name, args });
        return {
          data:
            name === "consume_rate_limit"
              ? rate
              : name === "is_super_admin"
                ? isOwner
                : name === "reserve_admin_invitation"
                  ? "invitation-id"
                  : null,
          error:
            name === "reserve_admin_invitation" && reserveError ? true : null,
        };
      },
      from: (name: string) => ({
        insert: async (value: any) => {
          calls.push({ name: "insert:" + name, args: value });
          return { error: null };
        },
      }),
    }),
  });
  return {
    handler,
    calls,
    setOwner: (v: boolean) => (isOwner = v),
    setRate: (v: boolean) => (rate = v),
    setAuth: (v: boolean) => (authValid = v),
    setInviteError: () => (inviteError = true),
    setReserveError: () => (reserveError = true),
  };
}
const request = (
  body: any = payload,
  authorization?: string,
  origin = "http://localhost:5173",
) =>
  new Request("https://example.invalid/functions/v1/school-accounts", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });
Deno.test(
  "accounts: rejects untrusted origins and malformed registration",
  async () => {
    const f = fixture();
    equal(
      (await f.handler(request(payload, undefined, "https://attacker.invalid")))
        .status,
      403,
    );
    equal((await f.handler(request({ ...payload, email: "bad" }))).status, 400);
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "accounts: honeypot and fast submission rejected before any service operation",
  async () => {
    const f = fixture();
    equal(
      (await f.handler(request({ ...payload, company_website: "spam" })))
        .status,
      400,
    );
    equal(
      (
        await f.handler(
          request({ ...payload, form_started_at: Date.now() + 100 }),
        )
      ).status,
      400,
    );
    equal(f.calls.length, 0);
  },
);
Deno.test("accounts: email gating does not create an account", async () => {
  const f = fixture({ SCHOOL_EMAIL_ENABLED: "false" });
  equal((await f.handler(request())).status, 503);
  equal(
    f.calls.map((c) => c.name),
    ["consume_rate_limit"],
  );
});
Deno.test("accounts: rate exhaustion prevents invitation", async () => {
  const f = fixture();
  f.setRate(false);
  equal((await f.handler(request())).status, 429);
  equal(f.calls.length, 1);
});
Deno.test(
  "accounts: teacher registration forces pending and ignores role escalation input",
  async () => {
    const f = fixture();
    equal(
      (
        await f.handler(
          request({
            ...payload,
            profile: {
              ...payload.profile,
              status: "approved",
              role: "super_admin",
            },
          }),
        )
      ).status,
      200,
    );
    const inserted = f.calls.find((c) => c.name === "insert:teacher_accounts")!;
    equal(inserted.args.status, "pending");
    equal(inserted.args.role, undefined);
    equal(inserted.args.user_id, "invited-user");
  },
);
Deno.test(
  "accounts: failed/duplicate teacher invite does not insert teacher or reveal registration",
  async () => {
    const f = fixture();
    f.setInviteError();
    const r = await f.handler(request());
    equal(r.status, 200);
    equal((await r.json()).submitted, true);
    equal(
      f.calls.some((c) => c.name.startsWith("insert:")),
      false,
    );
  },
);
Deno.test(
  "accounts: unauthenticated and invalid admin sessions denied",
  async () => {
    const f = fixture();
    const b = { action: "invite_admin", email: "invitee@example.test" };
    equal((await f.handler(request(b))).status, 401);
    f.setAuth(false);
    equal((await f.handler(request(b, "Bearer invalid"))).status, 401);
    equal(f.calls.length, 0);
  },
);
Deno.test(
  "accounts: secondary admin and teacher cannot invite admin",
  async () => {
    const f = fixture();
    f.setOwner(false);
    equal(
      (
        await f.handler(
          request(
            { action: "invite_admin", email: "invitee@example.test" },
            "Bearer fixture",
          ),
        )
      ).status,
      403,
    );
    equal(
      f.calls.map((c) => c.name),
      ["is_super_admin"],
    );
  },
);
Deno.test(
  "accounts: owner invitation reserves slot before email and finalizes sent state",
  async () => {
    const f = fixture();
    equal(
      (
        await f.handler(
          request(
            { action: "invite_admin", email: "invitee@example.test" },
            "Bearer fixture",
          ),
        )
      ).status,
      200,
    );
    equal(
      f.calls.map((c) => c.name),
      [
        "is_super_admin",
        "reserve_admin_invitation",
        "invite",
        "complete_admin_invitation",
      ],
    );
    equal(f.calls.at(-1)!.args, {
      p_id: "invitation-id",
      p_user: "invited-user",
      p_success: true,
    });
  },
);
Deno.test("accounts: occupied secondary slot prevents email", async () => {
  const f = fixture();
  f.setReserveError();
  equal(
    (
      await f.handler(
        request(
          { action: "invite_admin", email: "invitee@example.test" },
          "Bearer fixture",
        ),
      )
    ).status,
    409,
  );
  equal(
    f.calls.some((c) => c.name === "invite"),
    false,
  );
});
Deno.test(
  "accounts: SMTP failure finalizes failed reservation without granting access",
  async () => {
    const f = fixture();
    f.setInviteError();
    equal(
      (
        await f.handler(
          request(
            { action: "invite_admin", email: "invitee@example.test" },
            "Bearer fixture",
          ),
        )
      ).status,
      503,
    );
    equal(f.calls.at(-1)!.args.p_success, false);
    equal(
      f.calls.some((c) => c.name.startsWith("insert:")),
      false,
    );
  },
);
Deno.test(
  "accounts: optional CAPTCHA defaults fail closed without secret",
  async () => {
    const f = fixture({ CAPTCHA_MODE: "" });
    equal((await f.handler(request())).status, 503);
    equal(
      f.calls.some((c) => c.name === "invite"),
      false,
    );
  },
);
