import { createClient } from "npm:@supabase/supabase-js@2";
import { createAccountsHandler } from "./handler.ts";
Deno.serve(
  createAccountsHandler({
    env: (k) => Deno.env.get(k),
    client: (key, authorization) =>
      createClient(Deno.env.get("SUPABASE_URL")!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: authorization
          ? { headers: { Authorization: authorization } }
          : undefined,
      }),
  }),
);
