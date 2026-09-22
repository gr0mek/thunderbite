// The link a user clicks from the request-verification email. GET so it
// works as a plain browser link, no extra client involved.
import { escapeHtml } from "../_shared/emailTemplates.ts";
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
  if (!token) return page("Brak tokenu potwierdzenia.");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("subscribers")
    .update({ status: "verified", verified_at: new Date().toISOString(), verify_token: null })
    .eq("verify_token", token)
    .eq("status", "pending")
    .select("email")
    .maybeSingle();

  if (error) console.error("confirm-email update failed", error);

  if (!data) {
    return page("Ten link jest nieprawidłowy lub został już wykorzystany.");
  }
  return page(`Adres <strong>${escapeHtml(data.email)}</strong> został potwierdzony. Możesz zamknąć tę kartę.`);
});
