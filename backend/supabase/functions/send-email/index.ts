// Called by the extension whenever it needs to actually deliver an email —
// immediately for a single new offer, once a day for the digest, or when a
// site's been broken for a while (uxSmartBuy.md §5.6). The extension owns
// all scheduling/matching; this function only ever sees what one send
// needs (startSmartBuy.md §6 rule 18).
import { z } from "npm:zod@3";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  renderDailyDigestEmail,
  renderImmediateEmail,
  renderProblemEmail,
  type EmailOffer,
} from "../_shared/emailTemplates.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

const EmailOfferSchema = z.object({
  title: z.string(),
  price: z.number().nullable(),
  currency: z.string().optional(),
  site: z.string(),
  location: z.string().optional(),
  url: z.string().url(),
  imageUrl: z.string().url().optional(),
});

const RequestSchema = z.discriminatedUnion("kind", [
  z.object({
    email: z.string().email(),
    kind: z.literal("immediate"),
    offer: EmailOfferSchema,
  }),
  z.object({
    email: z.string().email(),
    kind: z.literal("daily"),
    offersByWatch: z.record(z.array(EmailOfferSchema)).refine((v) => Object.keys(v).length > 0, {
      message: "offersByWatch must not be empty",
    }),
  }),
  z.object({
    email: z.string().email(),
    kind: z.literal("problem"),
    site: z.string(),
    since: z.string(),
    affectedWatchNames: z.array(z.string()).min(1),
  }),
]);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") {
    return jsonResponse({ error: "method not allowed" }, { status: 405 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonResponse({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;
  const email = body.email.trim().toLowerCase();

  const supabase = supabaseAdmin();
  const { data: subscriber, error: lookupError } = await supabase
    .from("subscribers")
    .select("status, unsubscribe_token")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    console.error("subscriber lookup failed", lookupError);
    return jsonResponse({ error: "storage error" }, { status: 500 });
  }
  // Never send to an address that hasn't confirmed it, or that opted out.
  if (!subscriber || subscriber.status !== "verified") {
    return jsonResponse({ error: "email not verified" }, { status: 403 });
  }

  const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL");
  const settingsUrl = Deno.env.get("SETTINGS_URL"); // extension options page, chrome-extension://.../settings
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromAddress =
    Deno.env.get("RESEND_FROM") ?? "Thunder Bait <notifications@thunderbait.app>";
  if (!functionsBaseUrl || !settingsUrl || !resendKey) {
    throw new Error("FUNCTIONS_BASE_URL / SETTINGS_URL / RESEND_API_KEY not configured");
  }

  const links = {
    settingsUrl,
    unsubscribeUrl: `${functionsBaseUrl}/unsubscribe?token=${encodeURIComponent(subscriber.unsubscribe_token)}`,
  };

  const rendered =
    body.kind === "immediate"
      ? renderImmediateEmail(body.offer as EmailOffer, links)
      : body.kind === "daily"
        ? renderDailyDigestEmail(
            new Map(Object.entries(body.offersByWatch as Record<string, EmailOffer[]>)),
            links,
          )
        : renderProblemEmail(
            { site: body.site, since: body.since, affectedWatchNames: body.affectedWatchNames },
            links,
          );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromAddress,
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    }),
  });
  if (!res.ok) {
    console.error("Resend error", res.status, await res.text());
    return jsonResponse({ error: "email send failed" }, { status: 502 });
  }

  return jsonResponse({ ok: true });
});
