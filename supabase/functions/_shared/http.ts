export type Environment = (name: string) => string | undefined;
export const configuredList = (value: string | undefined) =>
  (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export function cors(req: Request, env: Environment) {
  const origin = req.headers.get("origin") || "";
  const allowed =
    origin !== "" && configuredList(env("ALLOWED_ORIGINS")).includes(origin);
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "X-Content-Type-Options": "nosniff",
  };
  if (allowed) headers["Access-Control-Allow-Origin"] = origin;
  return { allowed, headers };
}
export class BodyTooLarge extends Error {}
export async function boundedBody(
  req: Request,
  maximum: number,
): Promise<Uint8Array> {
  const length = Number(req.headers.get("content-length"));
  if (Number.isFinite(length) && length > maximum) throw new BodyTooLarge();
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maximum) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
