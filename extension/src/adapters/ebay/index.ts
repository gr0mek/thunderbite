import { codeForHttpStatus, ScanError, toScanError } from "@/shared/scanErrors";
import type { EbayCredentials } from "@/shared/schemas";
import { ChromeSessionStore, type KeyValueStore } from "@/storage/local";
import type {
  AdapterHealth,
  NormalizedOffer,
  RequestObserver,
  SearchQuery,
  SiteAdapter,
} from "../types";
import {
  buildQueryTexts,
  buildSearchParams,
  EBAY_API_URL,
  normalizeItem,
  SEARCH_PATH,
  SearchResponseSchema,
  searchHeaders,
} from "./api";
import {
  defaultHttpFetch,
  EbayTokenProvider,
  type HttpFetch,
  type HttpResponse,
  type ReadCredentials,
} from "./auth";

export interface EbayAdapterOptions {
  /** The user's keyset (Settings). Without one, searches fail with EBY-KEYS. */
  readCredentials: ReadCredentials;
  apiUrl?: string;
  http?: HttpFetch;
  /** Where the access token is cached between service-worker wake-ups. */
  tokenCache?: KeyValueStore;
  /** Pause between the calls of one search (multi-word keywords). */
  interRequestDelayMs?: number;
  requestTimeoutMs?: number;
  debug?: boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

function snippetOf(body: string): string | undefined {
  return body.replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
}

/** eBay's error body is `{ errors: [{ errorId, message }] }`; errorId 2001
 * is "Too many requests" (the daily quota). */
function ebayErrorNote(body: string): string | undefined {
  try {
    const first = (
      JSON.parse(body) as { errors?: { errorId?: number; message?: string }[] }
    ).errors?.[0];
    if (!first) return undefined;
    return `errorId ${first.errorId ?? "?"}: ${first.message ?? ""}`.slice(0, 200);
  } catch {
    return undefined;
  }
}

/** Turns a search response into raw item summaries, or throws a coded ScanError. */
export function interpretSearchResponse(res: HttpResponse, url: string): unknown[] {
  const details = {
    status: res.status,
    url,
    via: "sw" as const,
    snippet: snippetOf(res.body),
  };
  if (res.status < 200 || res.status >= 300) {
    throw new ScanError(
      codeForHttpStatus(res.status, "EBY"),
      `eBay responded ${res.status}${ebayErrorNote(res.body) ? ` (${ebayErrorNote(res.body)})` : ""}`,
      details,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new ScanError("EBY-JSON", "eBay response is not JSON", details);
  }
  const parsed = SearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ScanError("EBY-SHAPE", "Unexpected eBay search response shape", details);
  }
  return parsed.data.itemSummaries ?? [];
}

/**
 * eBay (ebay.com) through the official Browse API with the user's own
 * keyset — docs/adr-007-ebay-adapter.md. The service worker calls
 * api.ebay.com directly (host permission, so no CORS); a 401 means the
 * cached token went stale, so it is renewed once and the call retried.
 */
export function createEbayAdapter(options: EbayAdapterOptions): SiteAdapter {
  const apiUrl = options.apiUrl ?? EBAY_API_URL;
  const http = options.http ?? defaultHttpFetch;
  const now = options.now ?? Date.now;
  const tokens = new EbayTokenProvider(
    apiUrl,
    http,
    options.tokenCache ?? new ChromeSessionStore(),
    now,
  );
  const delayMs = options.interRequestDelayMs ?? 1500;
  const timeoutMs = options.requestTimeoutMs ?? 20_000;
  const sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

  async function credentials(): Promise<EbayCredentials> {
    const creds = await options.readCredentials();
    if (!creds) {
      throw new ScanError("EBY-KEYS", "No eBay API keys — add them in Settings → eBay");
    }
    return creds;
  }

  async function searchOnce(
    params: URLSearchParams,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<unknown[]> {
    const creds = await credentials();
    const url = `${apiUrl}${SEARCH_PATH}?${params.toString()}`;
    for (let attempt = 1; ; attempt++) {
      // One deadline for the token (if it needs renewing) and the search.
      const controller = new AbortController();
      const onAbort = () => controller.abort(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(
        () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
        timeoutMs,
      );
      let started = now();
      let res: HttpResponse;
      try {
        const token = await tokens.get(creds, controller.signal, onRequest, attempt > 1);
        started = now();
        res = await http(url, {
          headers: searchHeaders(token),
          signal: controller.signal,
        });
      } catch (err) {
        if (signal.aborted || err instanceof ScanError) throw err;
        const timedOut = controller.signal.aborted;
        const code = timedOut ? "EBY-TIMEOUT" : "EBY-NET";
        const message = err instanceof Error ? err.message : String(err);
        onRequest?.({
          url,
          via: "sw",
          attempt,
          status: null,
          ms: now() - started,
          code,
          note: message.slice(0, 200),
        });
        throw new ScanError(code, message, { url, via: "sw" });
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
      }
      const ms = now() - started;
      try {
        const items = interpretSearchResponse(res, url);
        onRequest?.({
          url,
          via: "sw",
          attempt,
          status: res.status,
          ms,
          items: items.length,
        });
        return items;
      } catch (err) {
        const e = toScanError(err, "EBY");
        const retry = res.status === 401 && attempt < 2;
        onRequest?.({
          url,
          via: "sw",
          attempt,
          status: res.status,
          ms,
          code: e.code,
          snippet: e.details.snippet,
          note: retry ? "token refresh + retry" : ebayErrorNote(res.body),
        });
        if (!retry) throw e;
      }
    }
  }

  async function search(
    query: SearchQuery,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<NormalizedOffer[]> {
    const byId = new Map<string, NormalizedOffer>();
    for (const [i, q] of buildQueryTexts(query.keywords).entries()) {
      if (i > 0) await sleep(delayMs);
      signal.throwIfAborted();
      const items = await searchOnce(buildSearchParams(q, query), signal, onRequest);
      for (const raw of items) {
        const offer = normalizeItem(raw, options.debug);
        if (offer && !byId.has(offer.externalId)) byId.set(offer.externalId, offer);
      }
    }
    return [...byId.values()];
  }

  async function healthCheck(onRequest?: RequestObserver): Promise<AdapterHealth> {
    try {
      // The Browse API needs some q; any common word has fresh listings.
      const items = await searchOnce(
        buildSearchParams("camera", {}, 5),
        new AbortController().signal,
        onRequest,
      );
      return items.some((raw) => normalizeItem(raw) !== null) ? "ok" : "degraded";
    } catch {
      return "broken";
    }
  }

  return {
    id: "ebay",
    // Each call counts against the keyset's 5 000/day; the interval the
    // user picks is what really spends it. This only spaces out bursts.
    minIntervalMs: 5_000,
    search,
    healthCheck,
    isConfigured: async () => !!(await options.readCredentials().catch(() => undefined)),
  };
}
