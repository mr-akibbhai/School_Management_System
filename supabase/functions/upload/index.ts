import { createClient } from "npm:@supabase/supabase-js@2";
const rules: Record<string, { max: number; types: string[] }> = {
  branding: { max: 5, types: ["image/jpeg", "image/png", "image/webp"] },
  teachers: { max: 5, types: ["image/jpeg", "image/png", "image/webp"] },
  gallery: {
    max: 25,
    types: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"],
  },
  "admission-documents": {
    max: 10,
    types: ["application/pdf", "image/jpeg", "image/png"],
  },
  "academic-documents": { max: 10, types: ["application/pdf"] },
  "website-media": { max: 5, types: ["image/jpeg", "image/png", "image/webp"] },
};
function detect(b: Uint8Array) {
  const ascii = (a: number, n: number) =>
    String.fromCharCode(...b.slice(a, a + n));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
    return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (ascii(4, 4) === "ftyp") return "video/mp4";
  if ([26, 69, 223, 163].every((v, i) => b[i] === v)) return "video/webm";
  return "";
}
Deno.serve(async (req) => {
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
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST" || !allowed.includes(origin))
    return reply({ error: "Not allowed" }, 403);
  const token = req.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return reply({ error: "Sign in required" }, 401);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    },
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return reply({ error: "Invalid session" }, 401);
  const admin = await client.rpc("is_admin");
  if (admin.error || !admin.data)
    return reply({ error: "Administrator required" }, 403);
  try {
    const form = await req.formData();
    const file = form.get("file");
    const bucket = String(form.get("bucket"));
    const rule = rules[bucket];
    if (
      !(file instanceof File) ||
      !rule ||
      file.size > rule.max * 1024 * 1024 ||
      file.size === 0
    )
      return reply({ error: "Invalid file or size" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detect(bytes);
    if (!rule.types.includes(mime) || mime !== file.type)
      return reply({ error: "Unsupported or mismatched file contents" }, 400);
    const ext: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
      "video/mp4": "mp4",
      "video/webm": "webm",
    };
    const path = `${user.id}/${crypto.randomUUID()}.${ext[mime]}`;
    const upload = await client.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (upload.error) throw upload.error;
    return reply({
      path,
      url:
        bucket === "admission-documents"
          ? null
          : client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
    });
  } catch {
    return reply({ error: "Upload failed" }, 400);
  }
});
