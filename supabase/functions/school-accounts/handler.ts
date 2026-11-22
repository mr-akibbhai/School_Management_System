import { z } from "npm:zod@4";
import {
  boundedBody,
  BodyTooLarge,
  cors,
  type Environment,
} from "../_shared/http.ts";
const profile = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  designation: z.string().trim().min(2).max(120),
  qualification: z.string().max(500).default(""),
  gender: z.string().max(40).default(""),
  biography: z.string().max(2000).default(""),
  joining_date: z.union([z.iso.date(), z.literal("")]).default(""),
  requested_assignments: z.string().max(2000).default(""),
});
export function createAccountsHandler(deps: {
  env: Environment;
  client: (key: string, authorization?: string) => any;
  fetch?: typeof fetch;
}) {
  return async (req: Request) => {
    const { allowed, headers } = cors(req, deps.env);
    const reply = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return reply({ error: "Origin not allowed" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply({ error: "Method not allowed" }, 405);
    try {
      if (!req.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "JSON required" }, 415);
      const body = JSON.parse(
        new TextDecoder().decode(await boundedBody(req, 16000)),
      );
      if (!["register_teacher", "invite_admin"].includes(body.action))
        return reply({ error: "Unknown action" }, 400);
      const email = z.email().max(254).parse(body.email).toLowerCase();
      const serviceKey = deps.env("SUPABASE_SERVICE_ROLE_KEY"),
        anonKey = deps.env("SUPABASE_ANON_KEY"),
        salt = deps.env("RATE_LIMIT_SALT");
      if (!serviceKey || !anonKey || !salt)
        return reply({ error: "Service unavailable" }, 503);
      const service = deps.client(serviceKey);
      if (body.action === "register_teacher") {
        const parsed = profile.parse(body.profile);
        const started = z.number().parse(body.form_started_at);
        const age = Date.now() - started;
        if (body.company_website || age < 1500 || age > 7200000)
          return reply({ error: "Refresh the form and try again" }, 400);
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              "unknown") +
              ":" +
              salt,
          ),
        );
        const hashed = Array.from(new Uint8Array(digest))
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
        const rate = await service.rpc("consume_rate_limit", { p_key: hashed });
        if (rate.error) return reply({ error: "Service unavailable" }, 503);
        if (rate.data !== true)
          return reply({ error: "Too many requests" }, 429);
        if ((deps.env("CAPTCHA_MODE") || "required") === "required") {
          const secret = deps.env("TURNSTILE_SECRET_KEY");
          if (!secret) return reply({ error: "Verification unavailable" }, 503);
          const token = z.string().min(1).max(2048).parse(body.captcha);
          const verified = await (deps.fetch || fetch)(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
              method: "POST",
              body: new URLSearchParams({ secret, response: token }),
              signal: AbortSignal.timeout(8000),
            },
          );
          const result = await verified.json();
          if (
            !result.success ||
            !(deps.env("TURNSTILE_HOSTNAMES") || "")
              .split(",")
              .map((v) => v.trim())
              .includes(result.hostname)
          )
            return reply({ error: "Verification failed" }, 400);
        } else if (deps.env("CAPTCHA_MODE") !== "disabled")
          return reply({ error: "Verification unavailable" }, 503);
        if (deps.env("SCHOOL_EMAIL_ENABLED") !== "true")
          return reply(
            {
              error:
                "Teacher registration email is pending school SMTP setup. Please contact the school.",
            },
            503,
          );
        const invited = await service.auth.admin.inviteUserByEmail(email, {
          redirectTo: new URL(
            "/admin/reset-password",
            req.headers.get("origin")!,
          ).href,
          data: { school_registration: "teacher" },
        });
        if (invited.error || !invited.data.user)
          return reply({
            submitted: true,
            message:
              "If registration can proceed, check your email. Contact the school if no message arrives.",
          });
        const { joining_date, ...fields } = parsed;
        const record = await service
          .from("teacher_accounts")
          .insert({
            ...fields,
            user_id: invited.data.user.id,
            joining_date: joining_date || null,
            status: "pending",
          });
        if (record.error)
          return reply(
            {
              error:
                "Registration requires school support. No access has been approved.",
            },
            503,
          );
        return reply({
          submitted: true,
          message:
            "Check your email to choose a password. School approval is required before dashboard access.",
        });
      }
      const authorization = req.headers.get("authorization") || "";
      if (!/^Bearer\s+\S+$/i.test(authorization))
        return reply({ error: "Sign in required" }, 401);
      const caller = deps.client(anonKey, authorization);
      const user = await caller.auth.getUser(
        authorization.replace(/^Bearer\s+/i, ""),
      );
      if (user.error || !user.data.user)
        return reply({ error: "Invalid session" }, 401);
      const role = await caller.rpc("is_super_admin");
      if (role.error || role.data !== true)
        return reply({ error: "Super Admin required" }, 403);
      if (deps.env("SCHOOL_EMAIL_ENABLED") !== "true")
        return reply(
          { error: "Invitations are pending school SMTP setup." },
          503,
        );
      const reserved = await caller.rpc("reserve_admin_invitation", {
        p_email: email,
      });
      if (reserved.error)
        return reply(
          {
            error:
              "An invitation or Admin already occupies the second slot, or this email is unavailable.",
          },
          409,
        );
      const invited = await service.auth.admin.inviteUserByEmail(email, {
        redirectTo: new URL("/admin/reset-password", req.headers.get("origin")!)
          .href,
      });
      const done = await service.rpc("complete_admin_invitation", {
        p_id: reserved.data,
        p_user: invited.data.user?.id || null,
        p_success: !invited.error && !!invited.data.user,
      });
      if (done.error)
        return reply(
          {
            error:
              "Invitation status requires school support. Do not create another invitation.",
          },
          503,
        );
      if (invited.error)
        return reply(
          { error: "Email delivery failed. Check SMTP before retrying." },
          503,
        );
      return reply({
        submitted: true,
        message:
          "Invitation sent. Admin access starts only after verified acceptance.",
      });
    } catch (e) {
      return reply(
        {
          error:
            e instanceof BodyTooLarge
              ? "Request too large"
              : "Please check the request fields.",
        },
        e instanceof BodyTooLarge ? 413 : 400,
      );
    }
  };
}
