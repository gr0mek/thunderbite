// The "Wypisz się" link in every email footer — one-time, no login
// (uxSmartBuy.md §5.6).
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

function page(message: string): Response {
  return new Response(
    `<!doctype html><html lang="pl"><meta charset="utf-8">
<body style="font-family:sans-serif;padding:48px;text-align:center;color:#1B1E24">
  <p>${message}</p>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return page("Brak tokenu.");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("subscribers")
    .update({ status: "unsubscribed" })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error) console.error("unsubscribe update failed", error);

  if (!data) return page("Ten link jest nieprawidłowy.");
  return page("Wypisano z powiadomień e-mail. Możesz zamknąć tę kartę.");
});
