// Shared adapter contract — startSmartBuy.md §5. Every marketplace adapter
// implements this and nothing else talks to a marketplace directly.

export type SiteId = "olx" | "vinted" | "allegro";

export interface SearchQuery {
  /** Any of these matching is enough (OR). */
  keywords: string[];
  /** None of these may appear (AND NOT). */
  excludeKeywords: string[];
  priceMin?: number;
  priceMax?: number;
  location?: { city: string; radiusKm?: number };
  condition?: "new" | "used" | "any";
  /** Site-specific extras, e.g. Vinted size. */
  extra?: Record<string, string>;
}

export interface NormalizedOffer {
  site: SiteId;
  /** ID from the source site — the deduplication key. */
  externalId: string;
  url: string;
  title: string;
  /** PLN; null for "free" / "negotiable" listings. */
  price: number | null;
  currency: "PLN" | string;
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
  search(query: SearchQuery, signal: AbortSignal): Promise<NormalizedOffer[]>;
  healthCheck(): Promise<AdapterHealth>;
}

/** Deduplication key — `${site}:${externalId}`, per startSmartBuy.md §5. */
export function offerKey(offer: Pick<NormalizedOffer, "site" | "externalId">): string {
  return `${offer.site}:${offer.externalId}`;
}
