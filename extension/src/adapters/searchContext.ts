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
 * Reads the current search query (and whatever filters are visible) off
 * an OLX/Vinted/Allegro search-results page. Blocked the same way as the
 * adapters (docs/adr-001-adapter-fixture-blocker.md): the query-param
 * names, and how to tell a search-results page apart from any other page
 * on these sites, are marketplace-specific facts this sandbox can't fetch
 * to verify, and startSmartBuy.md §6 rule 3 forbids guessing them.
 *
 * Returns null unconditionally until real fixtures unblock it — the
 * message-passing that carries this to the popup (content script →
 * background → popup) is real and wired up; only this function's body is
 * a stub.
 */
export function detectSearchContext(
  _site: SiteId,
  _url: URL,
  _doc: Document,
): SearchContext | null {
  return null;
}
