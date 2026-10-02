import type { SiteId } from "@/adapters/types";
import type { ScanErrorPrefix } from "./scanErrors";
import type { Watch } from "./schemas";

/** Every supported marketplace, in display order. */
export const ALL_SITES: SiteId[] = ["vinted", "ebay"];

/** The currency a site's prices (and so a watch's price filters and market
 * value) are in. eBay means ebay.com (EBAY_US) — docs/adr-007. */
export const SITE_CURRENCY: Record<SiteId, string> = {
  vinted: "PLN",
  ebay: "USD",
};

/** A watch searches one site, so its prices are in that site's currency. */
export function watchCurrency(watch: Pick<Watch, "sites">): string {
  return SITE_CURRENCY[watch.sites[0] ?? "vinted"];
}

/** Prefix of a site's scan error codes (VNT-403, EBY-429…). */
export const SITE_ERROR_PREFIX: Record<SiteId, ScanErrorPrefix> = {
  vinted: "VNT",
  ebay: "EBY",
};
