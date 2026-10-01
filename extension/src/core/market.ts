import {
  DEAL_SUSPICIOUS_BELOW_PCT,
  MARKET_MIN_SAMPLE,
  type MarketStats,
} from "@/shared/schemas";

/** Linear-interpolated percentile of an ascending-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0]!;
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/**
 * Market price from recent listing prices. The median (not the mean) so a
 * handful of 50 zł accessories or 9 000 zł bundles can't drag it around.
 * Returns null below MARKET_MIN_SAMPLE priced listings — too few to trust,
 * so deal mode stays quiet until it has learned enough.
 */
export function computeMarketStats(
  prices: number[],
  now = new Date(),
): MarketStats | null {
  const sorted = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (sorted.length < MARKET_MIN_SAMPLE) return null;
  return {
    median: Math.round(percentile(sorted, 0.5)),
    p25: Math.round(percentile(sorted, 0.25)),
    p75: Math.round(percentile(sorted, 0.75)),
    sampleSize: sorted.length,
    updatedAt: now.toISOString(),
  };
}

export type DealKind = "deal" | "suspicious";

/** Highest price that still counts as a deal. */
export function dealThreshold(median: number, thresholdPct: number): number {
  return Math.floor((median * thresholdPct) / 100);
}

/**
 * "deal" at or below thresholdPct of the median; "suspicious" below
 * DEAL_SUSPICIOUS_BELOW_PCT (usually an accessory or a scam, not the item);
 * null otherwise or when the price is unknown.
 */
export function classifyPrice(
  price: number | null,
  median: number,
  thresholdPct: number,
): DealKind | null {
  if (price === null || median <= 0) return null;
  if (price < (median * DEAL_SUSPICIOUS_BELOW_PCT) / 100) return "suspicious";
  if (price <= dealThreshold(median, thresholdPct)) return "deal";
  return null;
}

/** Percent below the median, e.g. 85 for a 300 zł offer vs 1 950 zł. */
export function discountPct(price: number, median: number): number {
  return Math.round((1 - price / median) * 100);
}
