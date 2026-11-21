import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicHandler } from "./handler.ts";
Deno.serve(
  createPublicHandler({
    env: (name) => Deno.env.get(name),
    client: (url, key) =>
      createClient(url, key, { auth: { persistSession: false } }),
  }),
);
