import { z } from "zod";
import type { NormalizedOffer, SearchQuery } from "../types";

// eBay's Browse API, searched with the user's own app keyset — see
// docs/adr-007-ebay-adapter.md and docs/research-ebay.md:
//
//   GET https://api.ebay.com/buy/browse/v1/item_summary/search?q=…
//       &sort=newlyListed&limit=…&filter=deliveryCountry:PL,price:[..],…
//   Authorization: Bearer <application token>       (./auth.ts)
//   X-EBAY-C-MARKETPLACE-ID: EBAY_US                (ebay.com, USD)
//   X-EBAY-C-ENDUSERCTX: contextualLocation=country%3DPL
//
// The end-user context makes shipping costs those to Poland.

export const EBAY_API_URL = "https://api.ebay.com";
export const SEARCH_PATH = "/buy/browse/v1/item_summary/search";
/** ebay.com. Prices come back in USD. */
export const MARKETPLACE_ID = "EBAY_US";
export const CURRENCY = "USD";
/** Only listings that ship here, with shipping costs to here. */
export const BUYER_COUNTRY = "PL";
export const PER_PAGE = 50;
/** Largest page the Browse API serves; used to seed deal mode. */
export const MAX_PER_PAGE = 200;

export function searchHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE_ID,
    "X-EBAY-C-ENDUSERCTX": `contextualLocation=country%3D${BUYER_COUNTRY}`,
  };
}

/**
 * The `q` values one search needs. eBay ORs comma-separated terms in
 * parentheses — `(nikon,canon)` — so single-word keywords share one call
 * (each call counts against the 5 000/day quota). How it treats a
 * multi-word term inside the parentheses isn't documented, so a keyword
 * with a space gets its own call, as on Vinted. The core matcher does the
 * final keyword/exclusion filtering either way.
 */
export function buildQueryTexts(keywords: string[]): string[] {
  const unique = [...new Set(keywords.map((k) => k.trim()).filter(Boolean))];
  // eBay's query syntax reserves these; plain words never need them.
  const clean = unique
    .map((k) =>
      k
        .replace(/[(),"*]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const single = clean.filter((k) => !k.includes(" "));
  const multi = clean.filter((k) => k.includes(" "));
  const texts = [...multi];
  if (single.length === 1) texts.unshift(single[0]!);
  else if (single.length > 1) texts.unshift(`(${single.join(",")})`);
  return texts;
}

/** Query params for one search call. */
export function buildSearchParams(
  q: string,
  query: Pick<SearchQuery, "priceMin" | "priceMax" | "condition" | "limit">,
  limit: number = Math.min(query.limit ?? PER_PAGE, MAX_PER_PAGE),
): URLSearchParams {
  const filters = [`deliveryCountry:${BUYER_COUNTRY}`];
  // Browse filter syntax: [10..50], [10] = 10 or more, [..50] = 50 or less.
  const { priceMin: min, priceMax: max } = query;
  if (min !== undefined || max !== undefined) {
    const range =
      max === undefined ? `${min}` : min === undefined ? `..${max}` : `${min}..${max}`;
    filters.push(`price:[${range}]`, `priceCurrency:${CURRENCY}`);
  }
  if (query.condition === "new") filters.push("conditions:{NEW}");
  if (query.condition === "used") filters.push("conditions:{USED}");

  const params = new URLSearchParams();
  params.set("q", q);
  params.set("sort", "newlyListed");
  params.set("limit", String(limit));
  params.set("filter", filters.join(","));
  return params;
}

// Lenient, like the Vinted parser: only what we read is declared, and one
// malformed item is dropped rather than failing the page.
const AmountSchema = z.object({
  value: z.union([z.string(), z.number()]),
  currency: z.string().nullish(),
});

export const EbayItemSchema = z
  .object({
    itemId: z.string(),
    legacyItemId: z.string().nullish(),
    title: z.string(),
    itemWebUrl: z.string().url(),
    price: AmountSchema.nullish(),
    currentBidPrice: AmountSchema.nullish(),
    buyingOptions: z.array(z.string()).nullish(),
    bidCount: z.number().int().nullish(),
    itemEndDate: z.string().nullish(),
    itemCreationDate: z.string().nullish(),
    image: z.object({ imageUrl: z.string().nullish() }).nullish(),
    thumbnailImages: z.array(z.object({ imageUrl: z.string().nullish() })).nullish(),
    itemLocation: z
      .object({ country: z.string().nullish(), city: z.string().nullish() })
      .nullish(),
    shippingOptions: z
      .array(z.object({ shippingCost: AmountSchema.nullish() }).passthrough())
      .nullish(),
    seller: z
      .object({
        username: z.string().nullish(),
        feedbackPercentage: z.union([z.string(), z.number()]).nullish(),
      })
      .nullish(),
  })
  .passthrough();
export type EbayItem = z.infer<typeof EbayItemSchema>;

/** A search with no results has no `itemSummaries` at all. */
export const SearchResponseSchema = z
  .object({ itemSummaries: z.array(z.unknown()).optional() })
  .passthrough();

function amount(a: z.infer<typeof AmountSchema> | null | undefined): number | null {
  if (!a) return null;
  const n = typeof a.value === "number" ? a.value : Number.parseFloat(a.value);
  return Number.isFinite(n) ? n : null;
}

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/** "v1|123456789|0" → "123456789", the number shown on ebay.com. */
function legacyId(item: EbayItem): string {
  return item.legacyItemId ?? item.itemId.split("|")[1] ?? item.itemId;
}

/** Maps one raw item summary to a NormalizedOffer, or null if it's unusable. */
export function normalizeItem(raw: unknown, debug = false): NormalizedOffer | null {
  const parsed = EbayItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;

  const isAuction = item.buyingOptions?.includes("AUCTION") ?? false;
  const priceSource = isAuction ? (item.currentBidPrice ?? item.price) : item.price;
  const currency = priceSource?.currency ?? CURRENCY;

  const offer: NormalizedOffer = {
    site: "ebay",
    externalId: legacyId(item),
    url: item.itemWebUrl,
    title: item.title,
    price: amount(priceSource),
    currency,
  };

  const imageUrl = item.image?.imageUrl ?? item.thumbnailImages?.[0]?.imageUrl;
  if (imageUrl && isUrl(imageUrl)) offer.imageUrl = imageUrl;
  const postedAt = isoDate(item.itemCreationDate);
  if (postedAt) offer.postedAt = postedAt;
  const location = [item.itemLocation?.city, item.itemLocation?.country]
    .filter(Boolean)
    .join(", ");
  if (location) offer.location = location;

  // Cheapest option to Poland, when it's priced in the listing's currency
  // (a calculated-at-checkout option has no cost).
  const shipping = (item.shippingOptions ?? [])
    .filter((o) => o.shippingCost && (o.shippingCost.currency ?? currency) === currency)
    .map((o) => amount(o.shippingCost))
    .filter((n): n is number => n !== null && n >= 0);
  if (shipping.length > 0) offer.shippingCost = Math.min(...shipping);

  if (isAuction) {
    offer.auction = {};
    const endsAt = isoDate(item.itemEndDate);
    if (endsAt) offer.auction.endsAt = endsAt;
    if (typeof item.bidCount === "number" && item.bidCount >= 0) {
      offer.auction.bidCount = item.bidCount;
    }
  }

  if (item.seller?.username) {
    offer.seller = { name: item.seller.username };
    const rating = Number.parseFloat(String(item.seller.feedbackPercentage ?? ""));
    if (Number.isFinite(rating)) offer.seller.rating = rating;
  }
  if (debug) offer.raw = raw;
  return offer;
}
