import { createClient } from "npm:@supabase/supabase-js@2";

// Service-role client: every function in this project uses it, since
// subscribers has no RLS policies (see migrations/0001_subscribers.sql) and
// is never meant to be touched by anything but these functions. The key is
// read from the function's own environment (set via `supabase secrets set`)
// — it never reaches the extension (startSmartBuy.md §6 rule 16).
export function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
