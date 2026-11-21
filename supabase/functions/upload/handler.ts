import {
  BodyTooLarge,
  boundedBody,
  cors,
  type Environment,
} from "../_shared/http.ts";
export const rules: Record<string, { max: number; types: string[] }> = {
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
export function detect(b: Uint8Array) {
  const ascii = (a: number, n: number) =>
    String.fromCharCode(...b.slice(a, a + n));
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v))
    return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (ascii(4, 4) === "ftyp") return "video/mp4";
  if ([26, 69, 223, 163].every((v, i) => b[i] === v)) return "video/webm";
  return "";
}
type UploadClient = {
  auth: {
    getUser: (
      token: string,
    ) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };
  rpc: (name: string) => PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        bytes: Uint8Array,
        options: { contentType: string; upsert: boolean },
      ) => PromiseLike<{ error: unknown }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};
export function createUploadHandler(deps: {
  env: Environment;
  client: (url: string, key: string, token: string) => UploadClient;
}) {
  return async (req: Request): Promise<Response> => {
    const { allowed, headers } = cors(req, deps.env),
      reply = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return reply({ error: "Not allowed" }, 403);
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply({ error: "Method not allowed" }, 405);
    const authorization = req.headers.get("authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(authorization))
      return reply({ error: "Sign in required" }, 401);
    const token = authorization.replace(/^Bearer\s+/i, ""),
      url = deps.env("SUPABASE_URL"),
      key = deps.env("SUPABASE_ANON_KEY");
    if (!url || !key) return reply({ error: "Service is not configured" }, 503);
    try {
      const client = deps.client(url, key, token),
        {
          data: { user },
          error,
        } = await client.auth.getUser(token);
      if (error || !user) return reply({ error: "Invalid session" }, 401);
      const admin = await client.rpc("is_admin");
      if (admin.error)
        return reply({ error: "Unable to verify administrator" }, 503);
      if (admin.data !== true)
        return reply({ error: "Administrator required" }, 403);
      if (
        !req.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("multipart/form-data")
      )
        return reply({ error: "Multipart form required" }, 415);
      const bytes = await boundedBody(req, 27 * 1024 * 1024),
        body = new Request(req.url, {
          method: "POST",
          headers: req.headers,
          body: bytes.slice().buffer,
        });
      const form = await body.formData(),
        file = form.get("file"),
        bucket = String(form.get("bucket")),
        rule = rules[bucket];
      if (
        !(file instanceof File) ||
        !rule ||
        !file.size ||
        file.size > rule.max * 1024 * 1024
      )
        return reply({ error: "Invalid file or size" }, 400);
      const contents = new Uint8Array(await file.arrayBuffer()),
        mime = detect(contents);
      if (!rule.types.includes(mime) || mime !== file.type)
        return reply({ error: "Unsupported or mismatched file contents" }, 400);
      const ext: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "application/pdf": "pdf",
          "video/mp4": "mp4",
          "video/webm": "webm",
        },
        path = `${user.id}/${crypto.randomUUID()}.${ext[mime]}`;
      const upload = await client.storage
        .from(bucket)
        .upload(path, contents, { contentType: mime, upsert: false });
      if (upload.error) throw upload.error;
      return reply({
        path,
        url:
          bucket === "admission-documents"
            ? null
            : client.storage.from(bucket).getPublicUrl(path).data.publicUrl,
      });
    } catch (error) {
      if (error instanceof BodyTooLarge)
        return reply({ error: "Request too large" }, 413);
      return reply({ error: "Upload failed" }, 400);
    }
  };
}
