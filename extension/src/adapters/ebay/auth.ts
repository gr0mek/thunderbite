import { ScanError } from "@/shared/scanErrors";
import type { EbayCredentials } from "@/shared/schemas";
import type { KeyValueStore } from "@/storage/local";
import type { RequestObserver } from "../types";

// Application access token (OAuth client credentials) for the Browse API:
//
//   POST https://api.ebay.com/identity/v1/oauth2/token
//   Authorization: Basic base64(<client_id>:<client_secret>)
//   grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope
//   → { access_token, expires_in: 7200, token_type: "Application Access Token" }
//
// The keyset is the user's own (Ustawienia → eBay), so the secret only
// ever leaves the browser towards api.ebay.com.

export const TOKEN_PATH = "/identity/v1/oauth2/token";
export const TOKEN_SCOPE = "https://api.ebay.com/oauth/api_scope";
const CACHE_KEY = "tb:ebay:token";
/** Renew this long before eBay's expiry, so a token never dies mid-scan. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export interface HttpResponse {
  status: number;
  body: string;
}
export type HttpFetch = (
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<HttpResponse>;

export const defaultHttpFetch: HttpFetch = async (url, init) => {
  const res = await fetch(url, { ...init, credentials: "omit", cache: "no-store" });
  return { status: res.status, body: await res.text() };
};

export type ReadCredentials = () => Promise<EbayCredentials | undefined>;

interface CachedToken {
  clientId: string;
  token: string;
  expiresAt: number;
}

function snippetOf(body: string): string | undefined {
  return body.replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
}

/** Fetches and caches application tokens for whatever keyset is configured. */
export class EbayTokenProvider {
  private memory: CachedToken | undefined;

  constructor(
    private readonly apiUrl: string,
    private readonly http: HttpFetch,
    private readonly cache: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  /** A valid token for `creds`, from cache unless `force` or expired. */
  async get(
    creds: EbayCredentials,
    signal: AbortSignal,
    onRequest?: RequestObserver,
    force = false,
  ): Promise<string> {
    if (!force) {
      const cached = this.memory ?? (await this.cache.get<CachedToken>(CACHE_KEY));
      if (
        cached &&
        cached.clientId === creds.clientId &&
        cached.expiresAt - EXPIRY_MARGIN_MS > this.now()
      ) {
        this.memory = cached;
        return cached.token;
      }
    }
    const fresh = await this.request(creds, signal, onRequest);
    this.memory = fresh;
    await this.cache.set(CACHE_KEY, fresh).catch(() => undefined);
    return fresh.token;
  }

  async clear(): Promise<void> {
    this.memory = undefined;
    await this.cache.remove(CACHE_KEY).catch(() => undefined);
  }

  private async request(
    creds: EbayCredentials,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<CachedToken> {
    const url = `${this.apiUrl}${TOKEN_PATH}`;
    const started = this.now();
    const trace = (
      status: number | null,
      extra: { code?: ScanError["code"]; note?: string; snippet?: string | undefined },
    ) =>
      onRequest?.({
        url,
        via: "sw",
        attempt: 1,
        status,
        ms: this.now() - started,
        ...extra,
      });

    let res: HttpResponse;
    try {
      res = await this.http(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: TOKEN_SCOPE,
        }).toString(),
        signal,
      });
    } catch (err) {
      if (signal.aborted) throw err;
      const message = err instanceof Error ? err.message : String(err);
      trace(null, { code: "EBY-NET", note: `token: ${message}`.slice(0, 200) });
      throw new ScanError("EBY-NET", `Token request failed: ${message}`, {
        url,
        via: "sw",
      });
    }

    const snippet = snippetOf(res.body);
    if (res.status === 400 || res.status === 401) {
      // invalid_client: wrong ID/secret, or a Sandbox keyset.
      trace(res.status, { code: "EBY-AUTH", note: "token", snippet });
      throw new ScanError("EBY-AUTH", `eBay rejected the API keys (HTTP ${res.status})`, {
        status: res.status,
        url,
        via: "sw",
        snippet,
      });
    }
    if (res.status < 200 || res.status >= 300) {
      const code =
        res.status === 429 ? "EBY-429" : res.status >= 500 ? "EBY-5XX" : "EBY-HTTP";
      trace(res.status, { code, note: "token", snippet });
      throw new ScanError(code, `Token request answered ${res.status}`, {
        status: res.status,
        url,
        via: "sw",
        snippet,
      });
    }
    let json: { access_token?: unknown; expires_in?: unknown };
    try {
      json = JSON.parse(res.body) as typeof json;
    } catch {
      trace(res.status, { code: "EBY-JSON", note: "token", snippet });
      throw new ScanError("EBY-JSON", "Token response is not JSON", {
        url,
        via: "sw",
        snippet,
      });
    }
    if (typeof json.access_token !== "string" || !json.access_token) {
      trace(res.status, { code: "EBY-SHAPE", note: "token" });
      throw new ScanError("EBY-SHAPE", "Token response has no access_token", {
        url,
        via: "sw",
      });
    }
    trace(res.status, { note: "token" });
    const ttlSeconds = typeof json.expires_in === "number" ? json.expires_in : 7200;
    return {
      clientId: creds.clientId,
      token: json.access_token,
      expiresAt: this.now() + ttlSeconds * 1000,
    };
  }
}
