// Thin client for the Supabase Edge Functions in backend/supabase/functions/.
// The functions base URL is build-time config, not a secret — it's just
// where the extension's own backend lives (startSmartBuy.md §6 rule 16:
// secrets stay server-side; nothing here is one).
import type { SiteId } from "@/adapters/types";
import { copy } from "./copy.pl";

export interface EmailOfferPayload {
  title: string;
  price: number | null;
  site: string;
  location?: string;
  url: string;
  imageUrl?: string;
}

async function post(path: string, body: unknown): Promise<void> {
  const baseUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error(
      "VITE_SUPABASE_FUNCTIONS_URL is not configured — set it in extension/.env before using email features.",
    );
  }
  const res = await fetch(`${baseUrl}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${path} failed: ${res.status} ${detail}`);
  }
}

export function requestEmailVerification(email: string): Promise<void> {
  return post("request-verification", { email });
}

export function sendImmediateEmail(
  email: string,
  offer: EmailOfferPayload,
): Promise<void> {
  return post("send-email", { email, kind: "immediate", offer });
}

export function sendDailyDigestEmail(
  email: string,
  offersByWatch: Record<string, EmailOfferPayload[]>,
): Promise<void> {
  return post("send-email", { email, kind: "daily", offersByWatch });
}

export function sendProblemEmail(
  email: string,
  args: { site: SiteId; since: string; affectedWatchNames: string[] },
): Promise<void> {
  return post("send-email", {
    email,
    kind: "problem",
    site: copy.siteNames[args.site],
    since: args.since,
    affectedWatchNames: args.affectedWatchNames,
  });
}
