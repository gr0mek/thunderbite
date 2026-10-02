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
 * Reads the current search query (and visible filters) off a marketplace
 * search page. Both keep the whole search in the URL, so the document
 * isn't needed.
 *
 * Vinted catalog page: Vinted keeps the whole search in the URL —
 * `/catalog?search_text=…&price_from=…&price_to=…` — the same parameters
 * the catalog API takes (see adapters/vinted/api.ts and
 * docs/adr-003-vinted-adapter.md), so the document isn't needed.
 *
 * eBay search results: `/sch/i.html?_nkw=…&_udlo=…&_udhi=…` (keywords,
 * min and max price in USD), sometimes under a category path such as
 * `/sch/15230/i.html`.
 *
 * Returns null anywhere else, or on a search page with no search text
 * (a filters-only browse has nothing to put in the watch's keywords).
 */
export function detectSearchContext(
  site: SiteId,
  url: URL,
  _doc: Document,
): SearchContext | null {
  const [queryParam, priceMaxParam] =
    site === "vinted"
      ? /^\/catalog\/?$/.test(url.pathname)
        ? ["search_text", "price_to"]
        : [null, null]
      : /^\/sch\/(?:[^/]+\/)*i\.html$/.test(url.pathname)
        ? ["_nkw", "_udhi"]
        : [null, null];
  if (!queryParam || !priceMaxParam) return null;

  const query = (url.searchParams.get(queryParam) ?? "").trim();
  if (!query) return null;

  const context: SearchContext = { query };
  const priceMax = Number.parseFloat(url.searchParams.get(priceMaxParam) ?? "");
  if (Number.isFinite(priceMax) && priceMax >= 0) context.priceMax = priceMax;
  return context;
}
