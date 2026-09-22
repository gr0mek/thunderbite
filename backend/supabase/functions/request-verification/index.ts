// Called by the extension's options page when the user enters an email
// (onboarding §5.5 / settings §5.4). Upserts a pending subscriber and sends
// a one-time confirmation link — no password, no account (uxSmartBuy §5.6).
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { escapeHtml } from "../_shared/emailTemplates.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  }

  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return jsonResponse({ error: "invalid email" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const verifyToken = crypto.randomUUID();

  const { error } = await supabase
    .from("subscribers")
    .upsert({ email, status: "pending", verify_token: verifyToken }, { onConflict: "email" });
  if (error) {
    console.error("subscribers upsert failed", error);
    return jsonResponse({ error: "storage error" }, { status: 500 });
  }

  const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress =
    Deno.env.get("RESEND_FROM") ?? "Thunder Bait <notifications@thunderbait.app>";
  if (!functionsBaseUrl || !resendKey) {
    throw new Error("FUNCTIONS_BASE_URL / RESEND_API_KEY not configured");
  }

  const confirmUrl = `${functionsBaseUrl}/confirm-email?token=${encodeURIComponent(verifyToken)}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: email,
      subject: "Potwierdź adres e-mail — Thunder Bait",
      html: `<p>Kliknij, aby potwierdzić <strong>${escapeHtml(email)}</strong> i zacząć otrzymywać powiadomienia:</p><p><a href="${confirmUrl}">Potwierdź adres</a></p>`,
      text: `Potwierdź adres e-mail: ${confirmUrl}`,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return jsonResponse({ error: "email send failed" }, { status: 502 });
  }

  return jsonResponse({ ok: true });
});
