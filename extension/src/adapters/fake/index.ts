import type {
  AdapterHealth,
  NormalizedOffer,
  SearchQuery,
  SiteAdapter,
  SiteId,
} from "../types";

/**
 * An obviously-fake SiteAdapter for wiring and testing the scheduler /
 * matcher / dedup / notifier pipeline end-to-end. It does NOT model any
 * real Vinted endpoint, selector or response shape — the real adapter
 * lives in ../vinted (docs/adr-003-vinted-adapter.md).
 *
 * Useful in dev (`npm run dev`, no real network calls) and in tests that
 * need a working SiteAdapter without depending on a real marketplace.
 */
export function createFakeAdapter(
  site: SiteId,
  source: NormalizedOffer[] | (() => NormalizedOffer[]) = [],
): SiteAdapter {
  return {
    id: site,
    minIntervalMs: 1000,
    async search(_query: SearchQuery, _signal: AbortSignal): Promise<NormalizedOffer[]> {
      return typeof source === "function" ? source() : source;
    },
    async healthCheck(): Promise<AdapterHealth> {
      return "ok";
    },
  };
}

/** A site the user hasn't set up (eBay without keys): health checks skip
 * it, and searching it fails like the real one does. */
export function createUnconfiguredAdapter(site: SiteId): SiteAdapter {
  return {
    ...createFakeAdapter(site),
    async search(): Promise<NormalizedOffer[]> {
      throw new Error(`${site} is not configured`);
    },
    async isConfigured() {
      return false;
    },
  };
}
