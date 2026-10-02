import { z } from "zod";
import type { NormalizedOffer, SearchQuery } from "../types";

// Vinted's catalogue API. In September 2026 Vinted retired the legacy
// www.vinted.<tld>/api/v2/catalog/items (it answers 404 to everything) and
// moved the catalogue to a dedicated host behind a bearer token — see
// docs/adr-005-vinted-svc-catalogue-api.md, which follows the migration in
// Vinted-Notifications' fork (mariostavrou83-create/Vinted-Notifications#1):
//
//   GET https://api.vinted.pl/svc-catalogue/items?search_text=…
//       &order=newest_first&page=1&per_page=…&price_from=…&price_to=…
//       &attribute_ids[status]=…
//   Authorization: Bearer <access_token_web cookie>
//   x-anon-id: <anon_id cookie>
//
// Both cookies are handed out by the www host on any plain request (HEAD /),
// so no account is needed — see ./index.ts.

/** The website: session cookies, item pages, the tab used as a fallback. */
export const VINTED_WEB_URL = "https://www.vinted.pl";
/** The catalogue API host. */
export const VINTED_API_URL = "https://api.vinted.pl";
export const CATALOG_ITEMS_PATH = "/svc-catalogue/items";
export const PER_PAGE = 20;
/** Largest page svc-catalogue serves; used to seed deal mode's price history. */
export const MAX_PER_PAGE = 96;

/**
 * Vinted's item-condition ("status") ids. "Nowy" covers both new-with-tags
 * (6) and new-without-tags (1); "Używany" covers very good (2), good (3)
 * and satisfactory (4).
 */
export const STATUS_IDS = {
  new: [6, 1],
  used: [2, 3, 4],
} as const;

/** Query params for one catalog request. Vinted's `search_text` is a single
 * phrase, so a watch's OR-keywords are searched one request each. Empty
 * values are left out: svc-catalogue answers 400 to a blank filter. */
export function buildCatalogParams(
  keyword: string,
  query: Pick<SearchQuery, "priceMin" | "priceMax" | "condition" | "limit">,
  perPage: number = Math.min(query.limit ?? PER_PAGE, MAX_PER_PAGE),
): URLSearchParams {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("search_text", keyword.trim());
  params.set("order", "newest_first");
  params.set("page", "1");
  params.set("per_page", String(perPage));
  if (query.priceMin !== undefined) params.set("price_from", String(query.priceMin));
  if (query.priceMax !== undefined) params.set("price_to", String(query.priceMax));
  if (query.condition === "new" || query.condition === "used") {
    params.set("attribute_ids[status]", STATUS_IDS[query.condition].join(","));
  }
  return params;
}

// Deliberately lenient: only the fields we read are declared, everything
// else passes through untouched, and price accepts both shapes the API has
// used (a `{amount, currency_code}` object, or a bare string next to a
// top-level `currency`). One malformed item is dropped, not the whole page.
const PriceSchema = z.union([
  z.object({
    amount: z.union([z.string(), z.number()]),
    currency_code: z.string().optional(),
  }),
  z.string(),
  z.number(),
]);

export const VintedItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    title: z.string(),
    url: z.string(),
    price: PriceSchema.nullish(),
    currency: z.string().nullish(),
    brand_title: z.string().nullish(),
    size_title: z.string().nullish(),
    photo: z
      .object({
        url: z.string().nullish(),
        high_resolution: z.object({ timestamp: z.number().nullish() }).nullish(),
      })
      .nullish(),
    user: z
      .object({
        login: z.string().nullish(),
        feedback_reputation: z.number().nullish(),
      })
      .nullish(),
  })
  .passthrough();
export type VintedItem = z.infer<typeof VintedItemSchema>;

export const CatalogResponseSchema = z
  .object({ items: z.array(z.unknown()) })
  .passthrough();

function parseAmount(value: string | number): number | null {
  const n =
    typeof value === "number" ? value : Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function absoluteUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Maps one raw catalog item to a NormalizedOffer, or null if it's unusable. */
export function normalizeItem(
  raw: unknown,
  baseUrl: string = VINTED_WEB_URL,
  debug = false,
): NormalizedOffer | null {
  const parsed = VintedItemSchema.safeParse(raw);
  if (!parsed.success) return null;
  const item = parsed.data;

  const url = absoluteUrl(item.url, baseUrl);
  if (!url) return null;

  let price: number | null = null;
  let currency = item.currency ?? "PLN";
  if (item.price != null) {
    if (typeof item.price === "object") {
      price = parseAmount(item.price.amount);
      currency = item.price.currency_code ?? currency;
    } else {
      price = parseAmount(item.price);
    }
  }

  const imageUrl = item.photo?.url ? absoluteUrl(item.photo.url, baseUrl) : null;
  // The legacy API's only listing time was the main photo's upload
  // timestamp; svc-catalogue dropped it, so this is usually absent now
  // (dedup is by id anyway — core/checkWatch.ts).
  const ts = item.photo?.high_resolution?.timestamp;
  const postedAt = typeof ts === "number" ? new Date(ts * 1000).toISOString() : undefined;

  const offer: NormalizedOffer = {
    site: "vinted",
    externalId: String(item.id),
    url,
    title: item.title,
    price,
    currency,
  };
  if (imageUrl) offer.imageUrl = imageUrl;
  if (postedAt) offer.postedAt = postedAt;
  if (item.user?.login) {
    offer.seller = { name: item.user.login };
    if (typeof item.user.feedback_reputation === "number") {
      offer.seller.rating = item.user.feedback_reputation;
    }
  }
  if (debug) offer.raw = raw;
  return offer;
}
