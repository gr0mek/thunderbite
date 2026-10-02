// Shared adapter contract — startSmartBuy.md §5. Every marketplace adapter
// implements this and nothing else talks to a marketplace directly.

import type { RequestTrace } from "@/shared/schemas";

export type { RequestTrace };
/** Optional per-request diagnostics sink (scan log, see core/checkWatch.ts). */
export type RequestObserver = (trace: RequestTrace) => void;

export type SiteId = "vinted" | "ebay";

export interface SearchQuery {
  /** Any of these matching is enough (OR). */
  keywords: string[];
  /** None of these may appear (AND NOT). */
  excludeKeywords: string[];
  priceMin?: number | undefined;
  priceMax?: number | undefined;
  location?: { city: string; radiusKm?: number | undefined } | undefined;
  condition?: "new" | "used" | "any" | undefined;
  /** How many listings to ask for (site default when omitted). */
  limit?: number | undefined;
  /** Site-specific extras, e.g. Vinted size. */
  extra?: Record<string, string> | undefined;
}

export interface NormalizedOffer {
  site: SiteId;
  /** ID from the source site — the deduplication key. */
  externalId: string;
  url: string;
  title: string;
  /** In `currency` (PLN on Vinted, USD on eBay); null for "free" /
   * "negotiable" listings. For an auction, the current bid. */
  price: number | null;
  currency: "PLN" | "USD" | string;
  /** Cheapest shipping to Poland, in `currency`; 0 = free. Absent when the
   * site doesn't say (Vinted) or it's calculated at checkout. */
  shippingCost?: number;
  /** Set for auctions (eBay): `price` is then the current bid, not what
   * the item will sell for. */
  auction?: { endsAt?: string; bidCount?: number };
  imageUrl?: string;
  location?: string;
  /** ISO 8601. */
  postedAt?: string;
  seller?: { name?: string; rating?: number };
  /** Debug mode only — never persisted or sent to the backend. */
  raw?: unknown;
}

export type AdapterHealth = "ok" | "degraded" | "broken";

export interface SiteAdapter {
  id: SiteId;
  /** Hard floor for this site, independent of the user's chosen interval. */
  minIntervalMs: number;
  /** Throws on failure — preferably a ScanError (shared/scanErrors.ts) so
   * the scan log gets a meaningful code. */
  search(
    query: SearchQuery,
    signal: AbortSignal,
    onRequest?: RequestObserver,
  ): Promise<NormalizedOffer[]>;
  healthCheck(onRequest?: RequestObserver): Promise<AdapterHealth>;
  /** False when the site can't be searched until the user sets something
   * up (eBay: their own API key). Health checks skip such sites. Absent =
   * always ready. */
  isConfigured?(): Promise<boolean>;
}

/** Deduplication key — `${site}:${externalId}`, per startSmartBuy.md §5. */
export function offerKey(offer: Pick<NormalizedOffer, "site" | "externalId">): string {
  return `${offer.site}:${offer.externalId}`;
}
