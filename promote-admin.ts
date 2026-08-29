// promote-admin.ts — grants admin access to an existing Supabase Auth user.
//
// WHY THIS EXISTS:
// /admin is now gated by a `role: "admin"` custom claim in the user's
// `app_metadata` (see proxy.ts), not just by having any account — customers
// can self-register through /register into the same Supabase Auth table.
// `app_metadata` can only be set with the service role key, so a customer
// can never grant themselves admin access. This script is how you do it.
//
// HOW TO RUN IT:
// 1. Create the account first — either sign up normally through /register,
//    or add it directly in the Supabase dashboard (Authentication > Users >
//    Add user).
// 2. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and
//    SUPABASE_SERVICE_ROLE_KEY set (same as seed.ts).
// 3. Run:
//      npx tsx promote-admin.ts someone@example.com
// 4. That account can now log in at /admin/login (or /login — either one
//    will land them on the dashboard).
//
// Pass a second argument of "revoke" to remove admin access instead:
//      npx tsx promote-admin.ts someone@example.com revoke

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

const email = process.argv[2];
const revoke = process.argv[3] === "revoke";

if (!email) {
  console.error("Usage: npx tsx promote-admin.ts someone@example.com [revoke]");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // admin.getUserByEmail isn't available on all supabase-js versions —
  // list + find is the portable way to look a user up by email.
  let page = 1;
  let match: { id: string; email?: string } | undefined;
  while (!match) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match || data.users.length < 200) break;
    page += 1;
  }

  if (!match) {
    console.error(`No account found for ${email}. Create it first via /register or the Supabase dashboard.`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(match.id, {
    app_metadata: { role: revoke ? null : "admin" },
  });
  if (error) throw error;

  console.log(revoke ? `Revoked admin access for ${email}.` : `Granted admin access to ${email}.`);
}

main();
