import { z } from "npm:zod@4";
import {
  BodyTooLarge,
  boundedBody,
  configuredList,
  cors,
  type Environment,
} from "../_shared/http.ts";
const admission = z.object({
  student_name: z.string().trim().min(2).max(120),
  guardian_name: z.string().trim().min(2).max(120),
  phone: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/),
  email: z.union([z.email().max(254), z.literal("")]),
  birth_date: z.iso
    .date()
    .refine((v) => v < new Date().toISOString().slice(0, 10)),
  class_level: z.coerce.number().int().min(1).max(5),
  address: z.string().trim().min(5).max(1000),
  consent: z.literal(true),
});
const payloadSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("admission"), payload: admission }),
  z.object({
    action: z.literal("contact"),
    payload: z.object({
      name: z.string().trim().min(2).max(120),
      email: z.email().max(254),
      phone: z.string().max(20),
      message: z.string().trim().min(10).max(4000),
    }),
  }),
  z.object({
    action: z.literal("track"),
    payload: z.object({ code: z.string().regex(/^[a-f0-9]{32}$/) }),
  }),
  z.object({
    action: z.literal("result"),
    payload: z.object({
      student_code: z.string().trim().min(1).max(50),
      access_code: z.string().regex(/^[a-f0-9]{32}$/),
    }),
  }),
]);
type Result = { data: unknown; error: unknown };
type PublicClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
  from: (table: string) => {
    insert: (data: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
  };
};
export function createPublicHandler(deps: {
  env: Environment;
  client: (url: string, key: string) => PublicClient;
  fetch?: typeof fetch;
}) {
  return async (req: Request): Promise<Response> => {
    const { allowed, headers } = cors(req, deps.env),
      respond = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status, headers });
    if (!allowed) return respond({ error: "Request not allowed" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return respond({ error: "Method not allowed" }, 405);
    if (
      !req.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return respond({ error: "JSON body required" }, 415);
    try {
      const bytes = await boundedBody(req, 16000),
        body = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      const parsed = payloadSchema.parse(body);
      const metadata = z
        .object({
          company_website: z.string().max(2000).default(""),
          form_started_at: z.number().finite().int().positive(),
          captcha: z.string().max(2048).optional().default(""),
        })
        .parse(body);
      const age = Date.now() - metadata.form_started_at;
      if (
        metadata.company_website.trim() ||
        age < 1500 ||
        age > 2 * 60 * 60 * 1000
      )
        return respond(
          { error: "Please refresh the form, wait a moment, and try again." },
          400,
        );
      const mode = deps.env("CAPTCHA_MODE") || "required";
      const secret = deps.env("TURNSTILE_SECRET_KEY"),
        salt = deps.env("RATE_LIMIT_SALT"),
        url = deps.env("SUPABASE_URL"),
        key = deps.env("SUPABASE_SERVICE_ROLE_KEY"),
        hostnames = configuredList(deps.env("TURNSTILE_HOSTNAMES"));
      if (!salt || !url || !key || !["required", "disabled"].includes(mode))
        return respond({ error: "Service is not configured" }, 503);
      if (mode === "required") {
        if (!secret || !hostnames.length)
          return respond(
            { error: "Security verification is not configured" },
            503,
          );
        if (!metadata.captcha)
          return respond({ error: "Complete the security check" }, 400);
        const check = await (deps.fetch || fetch)(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            body: new URLSearchParams({ secret, response: metadata.captcha }),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!check.ok)
          return respond(
            { error: "Security verification is temporarily unavailable" },
            503,
          );
        const verified = await check.json();
        if (!verified.success)
          return respond(
            { error: "Security check expired. Please retry." },
            400,
          );
        if (!hostnames.includes(verified.hostname))
          return respond({ error: "Invalid security check" }, 403);
      }
      const client = deps.client(url, key),
        ip =
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(ip + ":" + salt),
      );
      const rateKey = Array.from(new Uint8Array(digest))
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
      const limit = await client.rpc("consume_rate_limit", { p_key: rateKey });
      if (limit.error)
        return respond({ error: "Service is temporarily unavailable" }, 503);
      if (limit.data !== true)
        return respond({ error: "Too many requests. Please try later." }, 429);
      let result: Result;
      switch (parsed.action) {
        case "admission":
          result = await client.rpc("submit_admission", {
            p_payload: parsed.payload,
          });
          break;
        case "contact": {
          const insert = await client
            .from("contact_messages")
            .insert(parsed.payload);
          if (insert.error) throw insert.error;
          return respond({ submitted: true });
        }
        case "track":
          result = await client.rpc("track_admission", {
            p_code: parsed.payload.code,
          });
          break;
        case "result":
          result = await client.rpc("lookup_result", {
            p_student_code: parsed.payload.student_code,
            p_access_code: parsed.payload.access_code,
          });
          break;
      }
      if (result.error) throw result.error;
      return respond(result.data);
    } catch (error) {
      if (error instanceof BodyTooLarge)
        return respond({ error: "Request too large" }, 413);
      if (
        error instanceof z.ZodError ||
        error instanceof SyntaxError ||
        error instanceof TypeError
      )
        return respond({ error: "Please check the request fields." }, 400);
      return respond(
        {
          error:
            "Request could not be completed. Please try again or contact the school.",
        },
        400,
      );
    }
  };
}
