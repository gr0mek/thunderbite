import { codeForHttpStatus, ScanError, toScanError } from "@/shared/scanErrors";
import type { ScanErrorCode, Transport } from "@/shared/schemas";
import type {
  AdapterHealth,
  NormalizedOffer,
  RequestObserver,
  SearchQuery,
  SiteAdapter,
} from "../types";
import {
  buildCatalogParams,
  CATALOG_ITEMS_PATH,
  CatalogResponseSchema,
  normalizeItem,
  VINTED_BASE_URL,
} from "./api";
import {
  REQUEST_HEADERS,
  swFetch as defaultSwFetch,
  tabFetch as defaultTabFetch,
  createTransportPreference,
  type TransportPreference,
  type RawResponse,
  type SwFetch,
  type TabFetch,
} from "./transport";

export interface VintedAdapterOptions {
  baseUrl?: string;
  swFetch?: SwFetch;
  /** null disables the open-tab fallback. */
  tabFetch?: TabFetch | null;
  preference?: TransportPreference;
  /** Pause between the per-keyword requests of one search. */
  interRequestDelayMs?: number;
  requestTimeoutMs?: number;
  /** Attach the raw API item to each offer (debug mode only). */
  debug?: boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** Same budget as the reference client's `Requester.MAX_RETRIES`. */
const MAX_ATTEMPTS = 3;
/** Failures that mean "this transport isn't let in", worth retrying through
 * the other one. Rate limits and server errors would just repeat. 404 is
 * here because Vinted answers an unauthenticated API call with an HTML 404
 * page (the reference client treats 401 and 404 alike for this reason). */
const TRANSPORT_FAILURES = new Set<ScanErrorCode>([
  "VNT-401",
  "VNT-404",
  "VNT-403",
  "VNT-NET",
  "VNT-JSON",
  "VNT-TIMEOUT",
]);

function abortableSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippetOf(body: string): string | undefined {
  const s = body.replace(/\s+/g, " ").trim().slice(0, 300);
  return s || undefined;
}

/** Child signal that aborts with the parent or after `ms`. */
function withTimeout(parent: AbortSignal, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    ms,
  );
  const onAbort = () => controller.abort(parent.reason);
  parent.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => controller.signal.aborted && !parent.aborted,
    done: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", onAbort);
    },
  };
}

/** Turns a raw response into catalog items, or throws a coded ScanError. */
export function interpretCatalogResponse(
  res: RawResponse,
  url: string,
  via: Transport,
): unknown[] {
  const details = { status: res.status, url, via, snippet: snippetOf(res.body) };
  if (res.status === 0) {
    throw new ScanError("VNT-NET", `Network error: ${res.body.slice(0, 200)}`, details);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ScanError(
      codeForHttpStatus(res.status),
      `Vinted responded ${res.status}`,
      details,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(res.body);
  } catch {
    throw new ScanError("VNT-JSON", "Response is not JSON (anti-bot page?)", details);
  }
  const parsed = CatalogResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ScanError("VNT-SHAPE", "Unexpected catalog response shape", details);
  }
  return parsed.data.items;
}

/**
 * The real Vinted adapter (docs/adr-003, docs/adr-004).
 *
 * Each catalog request first goes out from the service worker with the
 * browser's own Vinted cookies. Like the reference client's
 * `Requester.get`, a 401/404 means "no/expired session": load the home page
 * to get fresh cookies and retry, up to 3 attempts. If the service worker
 * still isn't let in (401/403/404, a non-JSON anti-bot page, network error),
 * the same request is retried inside an open vinted.pl tab, and later
 * requests go there first for as long as that keeps working.
 */
export function createVintedAdapter(options: VintedAdapterOptions = {}): SiteAdapter {
  const baseUrl = options.baseUrl ?? VINTED_BASE_URL;
  const sw = options.swFetch ?? defaultSwFetch;
  const tab = options.tabFetch === undefined ? defaultTabFetch : options.tabFetch;
  const delayMs = options.interRequestDelayMs ?? 1500;
  const timeoutMs = options.requestTimeoutMs ?? 20_000;
  const sleep = options.sleep ?? abortableSleep;
  const preference = options.preference ?? createTransportPreference();

  async function refreshSession(signal: AbortSignal): Promise<void> {
    try {
      await sw(`${baseUrl}/`, {
        credentials: "include",
        headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
        signal,
      });
    } catch {
      // A failed refresh just means the retry fails too and reports why.
    }
  }

  async function viaServiceWorker(
    url: string,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<unknown[]> {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      const t = withTimeout(signal, timeoutMs);
      let res: RawResponse;
      try {
        res = await sw(url, {
          credentials: "include",
          headers: REQUEST_HEADERS,
          signal: t.signal,
        });
      } catch (err) {
        if (signal.aborted) throw err;
        const code = t.timedOut() ? "VNT-TIMEOUT" : "VNT-NET";
        const message = err instanceof Error ? err.message : String(err);
        onRequest?.({
          url,
          via: "sw",
          attempt,
          status: null,
          ms: Date.now() - started,
          code,
          note: message.slice(0, 200),
        });
        throw new ScanError(code, message, { url, via: "sw" });
      } finally {
        t.done();
      }
      const ms = Date.now() - started;
      try {
        const items = interpretCatalogResponse(res, url, "sw");
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
        const e = toScanError(err);
        const retry =
          (res.status === 401 || res.status === 404) && attempt < MAX_ATTEMPTS;
        onRequest?.({
          url,
          via: "sw",
          attempt,
          status: res.status,
          ms,
          code: e.code,
          snippet: e.details.snippet,
          note: retry ? "session refresh + retry" : undefined,
        });
        if (!retry) throw e;
        await refreshSession(signal);
      }
    }
  }

  /** null = no open Vinted tab to use. */
  async function viaTab(
    fetchInTab: TabFetch,
    url: string,
    onRequest?: RequestObserver,
  ): Promise<unknown[] | null> {
    const started = Date.now();
    let res: RawResponse | null;
    try {
      res = await fetchInTab(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onRequest?.({
        url,
        via: "tab",
        attempt: 1,
        status: null,
        ms: Date.now() - started,
        code: "VNT-NET",
        note: `executeScript: ${message}`.slice(0, 200),
      });
      throw new ScanError("VNT-NET", `Tab fetch failed: ${message}`, { url, via: "tab" });
    }
    if (res === null) {
      onRequest?.({
        url,
        via: "tab",
        attempt: 1,
        status: null,
        ms: 0,
        note: "no usable vinted.pl tab",
      });
      return null;
    }
    const ms = Date.now() - started;
    try {
      const items = interpretCatalogResponse(res, url, "tab");
      onRequest?.({
        url,
        via: "tab",
        attempt: 1,
        status: res.status,
        ms,
        items: items.length,
      });
      return items;
    } catch (err) {
      const e = toScanError(err);
      onRequest?.({
        url,
        via: "tab",
        attempt: 1,
        status: res.status,
        ms,
        code: e.code,
        snippet: e.details.snippet,
      });
      throw e;
    }
  }

  async function getCatalog(
    params: URLSearchParams,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<unknown[]> {
    const url = `${baseUrl}${CATALOG_ITEMS_PATH}?${params.toString()}`;
    const preferTab = tab ? await preference.get().catch(() => false) : false;
    const order: Transport[] = preferTab ? ["tab", "sw"] : ["sw", "tab"];
    let firstError: ScanError | undefined;
    let noTab = false;

    for (const via of order) {
      try {
        if (via === "sw") {
          const items = await viaServiceWorker(url, signal, onRequest);
          if (preferTab) await preference.set(false).catch(() => undefined);
          return items;
        }
        if (!tab) continue;
        const items = await viaTab(tab, url, onRequest);
        if (items === null) {
          noTab = true;
          continue;
        }
        if (!preferTab) await preference.set(true).catch(() => undefined);
        return items;
      } catch (err) {
        if (signal.aborted) throw err;
        const e = toScanError(err);
        firstError ??= e;
        if (!TRANSPORT_FAILURES.has(e.code)) throw e;
      }
    }

    const e = firstError ?? new ScanError("APP-UNKNOWN", "No transport available");
    if (noTab && TRANSPORT_FAILURES.has(e.code)) {
      e.message +=
        " — no usable vinted.pl tab to fetch through (open one and keep it open)";
    }
    throw e;
  }

  async function search(
    query: SearchQuery,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<NormalizedOffer[]> {
    const keywords = [...new Set(query.keywords.map((k) => k.trim()).filter(Boolean))];
    const byId = new Map<string, NormalizedOffer>();
    for (const [i, keyword] of keywords.entries()) {
      if (i > 0) await sleep(delayMs);
      signal.throwIfAborted();
      const items = await getCatalog(
        buildCatalogParams(keyword, query),
        signal,
        onRequest,
      );
      for (const raw of items) {
        const offer = normalizeItem(raw, baseUrl, options.debug);
        if (offer && !byId.has(offer.externalId)) byId.set(offer.externalId, offer);
      }
    }
    return [...byId.values()];
  }

  async function healthCheck(onRequest?: RequestObserver): Promise<AdapterHealth> {
    try {
      // An empty search_text with newest_first is just "latest listings" —
      // it should never legitimately come back empty.
      const items = await getCatalog(
        buildCatalogParams("", {}, 5),
        new AbortController().signal,
        onRequest,
      );
      const usable = items.filter((raw) => normalizeItem(raw, baseUrl) !== null);
      return usable.length > 0 ? "ok" : "degraded";
    } catch {
      return "broken";
    }
  }

  return {
    id: "vinted",
    // Spacing between two watches' searches, serialized by SiteRateLimiter.
    // The reference project polls every query back-to-back once a minute;
    // a few seconds apart is gentler while staying well inside an MV3
    // service worker's idle lifetime (the limiter waits with setTimeout).
    minIntervalMs: 5_000,
    search,
    healthCheck,
  };
}
