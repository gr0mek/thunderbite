import type { SiteId } from "./types";

/** What the F3 "Obserwuj to wyszukiwanie" banner needs to pre-fill the
 * form (uxSmartBuy.md §4 F3 / §2 app map — it's rendered in the popup,
 * not injected into the host page). */
export interface SearchContext {
  query: string;
  priceMax?: number;
  location?: { city: string };
}

/**
 * Reads the current search query (and visible filters) off a Vinted
 * catalog page. Vinted keeps the whole search in the URL —
 * `/catalog?search_text=…&price_from=…&price_to=…` — the same parameters
 * the catalog API takes (see adapters/vinted/api.ts and
 * docs/adr-003-vinted-adapter.md), so the document isn't needed.
 *
 * Returns null anywhere else, or on a catalog page with no search text
 * (a filters-only browse has nothing to put in the watch's keywords).
 */
export function detectSearchContext(
  site: SiteId,
  url: URL,
  _doc: Document,
): SearchContext | null {
  if (site !== "vinted") return null;
  if (!/^\/catalog\/?$/.test(url.pathname)) return null;

  const query = (url.searchParams.get("search_text") ?? "").trim();
  if (!query) return null;

  const context: SearchContext = { query };
  const priceMax = Number.parseFloat(url.searchParams.get("price_to") ?? "");
  if (Number.isFinite(priceMax) && priceMax >= 0) context.priceMax = priceMax;
  return context;
}
