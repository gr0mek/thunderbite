import type { AdapterHealth, NormalizedOffer, SearchQuery, SiteAdapter } from "../types";
import {
  buildCatalogParams,
  CATALOG_ITEMS_PATH,
  CatalogResponseSchema,
  normalizeItem,
  VINTED_BASE_URL,
} from "./api";

/** Non-2xx answer from Vinted, kept distinct so callers/logs see the status. */
export class VintedHttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`Vinted responded ${status} for ${url}`);
    this.name = "VintedHttpError";
  }
}

export interface VintedAdapterOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Pause between the per-keyword requests of one search. */
  interRequestDelayMs?: number;
  /** Attach the raw API item to each offer (debug mode only). */
  debug?: boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** Same budget as the reference client's `Requester.MAX_RETRIES`. */
const MAX_ATTEMPTS = 3;

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/**
 * The real Vinted adapter. Fetches run from the service worker with
 * `credentials: "include"`, so they carry the browser's own Vinted cookies
 * (host_permissions make them first-party to the extension). If Vinted
 * answers 401/404 — its "no/expired session" responses, per the reference
 * client — we load the home page once to get fresh session cookies and
 * retry, exactly like `pyVintedVN`'s `Requester.get`/`set_cookies`.
 */
export function createVintedAdapter(options: VintedAdapterOptions = {}): SiteAdapter {
  const baseUrl = options.baseUrl ?? VINTED_BASE_URL;
  const doFetch =
    options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const delayMs = options.interRequestDelayMs ?? 1500;
  const sleep = options.sleep ?? ((ms: number) => abortableSleep(ms));

  async function refreshSession(signal: AbortSignal): Promise<void> {
    try {
      await doFetch(`${baseUrl}/`, { method: "HEAD", credentials: "include", signal });
    } catch {
      // A failed refresh just means the retry fails too and reports why.
    }
  }

  async function getCatalog(
    params: URLSearchParams,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    const url = `${baseUrl}${CATALOG_ITEMS_PATH}?${params.toString()}`;
    let lastStatus = 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await doFetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      if (res.ok) {
        const parsed = CatalogResponseSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("Unexpected Vinted catalog response shape");
        return parsed.data.items;
      }
      lastStatus = res.status;
      if ((res.status === 401 || res.status === 404) && attempt < MAX_ATTEMPTS) {
        await refreshSession(signal);
        continue;
      }
      break;
    }
    throw new VintedHttpError(lastStatus, url);
  }

  async function search(
    query: SearchQuery,
    signal: AbortSignal,
  ): Promise<NormalizedOffer[]> {
    const keywords = [...new Set(query.keywords.map((k) => k.trim()).filter(Boolean))];
    const byId = new Map<string, NormalizedOffer>();
    for (const [i, keyword] of keywords.entries()) {
      if (i > 0) await sleep(delayMs);
      signal.throwIfAborted();
      const items = await getCatalog(buildCatalogParams(keyword, query), signal);
      for (const raw of items) {
        const offer = normalizeItem(raw, baseUrl, options.debug);
        if (offer && !byId.has(offer.externalId)) byId.set(offer.externalId, offer);
      }
    }
    return [...byId.values()];
  }

  async function healthCheck(): Promise<AdapterHealth> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      // An empty search_text with newest_first is just "latest listings" —
      // it should never legitimately come back empty.
      const items = await getCatalog(buildCatalogParams("", {}, 5), controller.signal);
      const usable = items.filter((raw) => normalizeItem(raw, baseUrl) !== null);
      return usable.length > 0 ? "ok" : "degraded";
    } catch {
      return "broken";
    } finally {
      clearTimeout(timeout);
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
