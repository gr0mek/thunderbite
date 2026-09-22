// These functions are called from a chrome-extension:// origin, which can't
// be pinned to a single value the way a web app's domain can (it's
// per-install, and differs between the Chrome Web Store ID and unpacked
// dev IDs). None of the endpoints rely on ambient credentials (no cookies),
// so a wildcard origin doesn't introduce CSRF risk — every request is
// authorized by an opaque token in its body/query, not by who's asking.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...init.headers },
  });
}
