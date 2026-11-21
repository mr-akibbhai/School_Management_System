import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";
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
const contact = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  phone: z.string().max(20),
  message: z.string().trim().min(10).max(4000),
});
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((x) => x.trim());
  const headers = {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST" || !allowed.includes(origin))
    return respond({ error: "Request not allowed" }, 403);
  try {
    const raw = await req.text();
    if (raw.length > 16000) return respond({ error: "Request too large" }, 413);
    const { action, payload, captcha } = JSON.parse(raw);
    if (typeof captcha !== "string" || captcha.length > 2048)
      return respond({ error: "Complete the security check" }, 400);
    const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!secret) return respond({ error: "Service is not configured" }, 503);
    const check = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: captcha }),
      },
    );
    const verified = await check.json();
    if (!verified.success)
      return respond({ error: "Security check expired. Please retry." }, 400);
    const hostnames = (Deno.env.get("TURNSTILE_HOSTNAMES") || "")
      .split(",")
      .map((x) => x.trim());
    if (!hostnames.includes(verified.hostname))
      return respond({ error: "Invalid security check" }, 403);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        ip + ":" + (Deno.env.get("RATE_LIMIT_SALT") || secret),
      ),
    );
    const rateKey = Array.from(new Uint8Array(digest))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    const limit = await client.rpc("consume_rate_limit", { p_key: rateKey });
    if (limit.error || !limit.data)
      return respond({ error: "Too many requests. Please try later." }, 429);
    let result;
    if (action === "admission")
      result = await client.rpc("submit_admission", {
        p_payload: admission.parse(payload),
      });
    else if (action === "contact") {
      const { error } = await client
        .from("contact_messages")
        .insert(contact.parse(payload));
      if (error) throw error;
      return respond({ submitted: true });
    } else if (action === "track")
      result = await client.rpc("track_admission", {
        p_code: z
          .string()
          .regex(/^[a-f0-9]{32}$/)
          .parse(payload.code),
      });
    else if (action === "result")
      result = await client.rpc("lookup_result", {
        p_student_code: z.string().min(1).max(50).parse(payload.student_code),
        p_access_code: z
          .string()
          .regex(/^[a-f0-9]{32}$/)
          .parse(payload.access_code),
      });
    else return respond({ error: "Unknown request" }, 400);
    if (result.error) throw result.error;
    return respond(result.data);
  } catch (error) {
    if (error instanceof z.ZodError)
      return respond({ error: "Please check the form fields." }, 400);
    return respond(
      {
        error:
          "Request could not be completed. Please try again or contact the school.",
      },
      400,
    );
  }
});
