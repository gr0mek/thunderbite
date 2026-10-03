// Pure helpers for scripts/vinted-probe.ts, kept separate so they can be
// unit-tested without touching the network.
//
// The request contract mirrors the extension's Vinted adapter
// (extension/src/adapters/vinted/api.ts + transport.ts, docs/adr-005). It is
// duplicated here on purpose: the probe must run on a bare VPS with only this
// package installed. Stage 1 of mvp-cloud-version moves the real contract to
// packages/core and the server will import it from there.

export const VINTED_WEB_URL = "https://www.vinted.pl";
export const VINTED_API_URL = "https://api.vinted.pl";
export const CATALOG_ITEMS_PATH = "/svc-catalogue/items";

/** A Node fetch otherwise announces itself as "node"; anti-bot layers
 * reject that outright, so the probe looks like the browser the extension
 * runs in. */
export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
};

export interface VintedSession {
  token?: string | undefined;
  anonId?: string | undefined;
  /** Every cookie from the home page, sent back as a Cookie header. */
  cookieHeader: string;
}

/** Collects name=value pairs from Set-Cookie headers (attributes dropped). */
export function parseSetCookies(setCookies: string[]): Map<string, string> {
  const jar = new Map<string, string>();
  for (const line of setCookies) {
    const pair = line.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return jar;
}

export function sessionFromCookies(jar: Map<string, string>): VintedSession {
  return {
    token: jar.get("access_token_web"),
    anonId: jar.get("anon_id"),
    cookieHeader: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
  };
}

/** Headers for svc-catalogue, matching what the website (and the
 * extension's declarativeNetRequest rule) sends. */
export function catalogHeaders(session: VintedSession): Record<string, string> {
  const headers: Record<string, string> = {
    ...BROWSER_HEADERS,
    Accept: "application/json, text/plain, */*",
    Origin: VINTED_WEB_URL,
    Referer: `${VINTED_WEB_URL}/`,
  };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (session.anonId) headers["x-anon-id"] = session.anonId;
  if (session.cookieHeader) headers.Cookie = session.cookieHeader;
  return headers;
}

export function catalogUrl(apiUrl: string, searchText: string, perPage = 20): string {
  const params = new URLSearchParams();
  if (searchText.trim()) params.set("search_text", searchText.trim());
  params.set("order", "newest_first");
  params.set("page", "1");
  params.set("per_page", String(perPage));
  return `${apiUrl}${CATALOG_ITEMS_PATH}?${params}`;
}

/** Same codes as the extension's diagnostics (SCAN_ERROR_CODES), plus OK. */
export type ProbeCode =
  | "OK"
  | "VNT-401"
  | "VNT-403"
  | "VNT-404"
  | "VNT-429"
  | "VNT-5XX"
  | "VNT-HTTP"
  | "VNT-NET"
  | "VNT-TIMEOUT"
  | "VNT-JSON"
  | "VNT-SHAPE"
  | "VNT-EMPTY";

export function codeForStatus(status: number): ProbeCode {
  if (status === 401) return "VNT-401";
  if (status === 403) return "VNT-403";
  if (status === 404) return "VNT-404";
  if (status === 429) return "VNT-429";
  if (status >= 500) return "VNT-5XX";
  return "VNT-HTTP";
}

/** Classifies a catalogue response body that came back with HTTP 200. */
export function classifyCatalogBody(body: string): { code: ProbeCode; items: number } {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    // A 200 HTML page here is almost always an anti-bot challenge.
    return { code: "VNT-JSON", items: 0 };
  }
  const items = (json as { items?: unknown } | null)?.items;
  if (!Array.isArray(items)) return { code: "VNT-SHAPE", items: 0 };
  if (items.length === 0) return { code: "VNT-EMPTY", items: 0 };
  return { code: "OK", items: items.length };
}

export interface Attempt {
  ts: string;
  round: number;
  step: "session" | "catalog";
  status: number | null;
  ms: number;
  code: ProbeCode;
  items?: number;
  /** First characters of a failed response, to tell a challenge from an API error. */
  snippet?: string;
}

export type Verdict = "OK" | "PARTIAL" | "BLOCKED" | "NO-CONNECTION" | "NO-DATA";

export interface Summary {
  rounds: number;
  okRounds: number;
  successRate: number;
  codes: Record<string, number>;
  longestFailureStreak: number;
  medianCatalogMs: number | null;
  verdict: Verdict;
}

/**
 * A round succeeds when its last catalogue attempt returned items.
 * Verdict thresholds: ≥ 95 % of rounds OK → the host can run the scanner;
 * ≥ 60 % → usable with backoff but expect gaps; below that → blocked, use
 * plan B (home device or residential proxy). If no round succeeded and
 * every catalogue failure was a network error or timeout, Vinted never
 * answered at all — that's a connectivity (or proxy) problem, not a block.
 */
export function summarize(attempts: Attempt[]): Summary {
  const lastCatalogByRound = new Map<number, Attempt>();
  const codes: Record<string, number> = {};
  const catalogMs: number[] = [];
  for (const a of attempts) {
    codes[`${a.step}:${a.code}`] = (codes[`${a.step}:${a.code}`] ?? 0) + 1;
    if (a.step === "catalog") {
      lastCatalogByRound.set(a.round, a);
      if (a.code === "OK") catalogMs.push(a.ms);
    }
  }
  const roundIds = [...new Set(attempts.map((a) => a.round))].sort((x, y) => x - y);
  let okRounds = 0;
  let streak = 0;
  let longestFailureStreak = 0;
  for (const id of roundIds) {
    if (lastCatalogByRound.get(id)?.code === "OK") {
      okRounds++;
      streak = 0;
    } else {
      streak++;
      longestFailureStreak = Math.max(longestFailureStreak, streak);
    }
  }
  const rounds = roundIds.length;
  const successRate = rounds ? okRounds / rounds : 0;
  catalogMs.sort((x, y) => x - y);
  const medianCatalogMs = catalogMs.length
    ? (catalogMs[Math.floor(catalogMs.length / 2)] ?? null)
    : null;
  const catalogCodes = [...lastCatalogByRound.values()].map((a) => a.code);
  const neverAnswered =
    okRounds === 0 &&
    catalogCodes.length > 0 &&
    catalogCodes.every((c) => c === "VNT-NET" || c === "VNT-TIMEOUT");
  const verdict: Verdict =
    rounds === 0
      ? "NO-DATA"
      : neverAnswered
        ? "NO-CONNECTION"
        : successRate >= 0.95
          ? "OK"
          : successRate >= 0.6
            ? "PARTIAL"
            : "BLOCKED";
  return {
    rounds,
    okRounds,
    successRate,
    codes,
    longestFailureStreak,
    medianCatalogMs,
    verdict,
  };
}

export function snippet(body: string, max = 160): string {
  return body.replace(/\s+/g, " ").trim().slice(0, max);
}
