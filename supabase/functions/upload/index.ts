import { createClient } from "npm:@supabase/supabase-js@2";
import { createUploadHandler } from "./handler.ts";
Deno.serve(
  createUploadHandler({
    env: (name) => Deno.env.get(name),
    client: (url, key, token) =>
      createClient(url, key, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }),
  }),
);
