// Run locally by the project owner. Secrets come only from the process environment.
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, SITE_URL } =
  process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL || !SITE_URL)
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and SITE_URL securely in this process. Never commit credentials.",
  );
if (new URL(SUPABASE_URL).origin !== "https://nfoohhydncflcbegrxbz.supabase.co")
  throw new Error(
    "Refusing setup: this script is restricted to the confirmed new school project.",
  );
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ADMIN_EMAIL))
  throw new Error("Supply the exact valid owner email.");
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const existing = await client.from("admins").select("user_id").limit(1);
if (existing.error) throw new Error("Apply the database migrations first.");
if (existing.data.length)
  throw new Error(
    "An administrator already exists. Use account recovery; setup cannot create another administrator.",
  );
const invite = await client.auth.admin.inviteUserByEmail(ADMIN_EMAIL, {
  redirectTo: `${SITE_URL.replace(/\/$/, "")}/admin/reset-password`,
});
if (invite.error)
  throw new Error(
    "Invitation failed. Check SMTP configuration and whether this email is already registered.",
  );
const role = await client.from("admins").insert({
  user_id: invite.data.user.id,
  display_name: "School administrator",
});
if (role.error)
  throw new Error(
    "Invitation sent but administrator assignment failed. Use the Supabase SQL editor to assign the invited user ID after checking that no administrator already exists.",
  );
console.log(
  "Administrator invitation sent. Open your email and set your own password. No password was generated or stored by this script.",
);
