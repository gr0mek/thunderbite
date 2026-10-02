import {
  offerKey,
  type NormalizedOffer,
  type SearchQuery,
  type SiteAdapter,
  type SiteId,
} from "@/adapters/types";
import {
  OfferRecordSchema,
  type OfferRecord,
  type RequestTrace,
  type ScanRecord,
  type Watch,
} from "@/shared/schemas";
import { toScanError, type ScanError } from "@/shared/scanErrors";
import { SITE_ERROR_PREFIX } from "@/shared/sites";
import type { Notifier } from "@/background/notifier";
import type { SiteRateLimiter } from "@/background/rateLimiter";
import type { Logger } from "@/shared/logger";
import type { OfferRepo } from "@/storage/offerRepo";
import type { SiteHealthRepo } from "@/storage/siteHealthRepo";
import type { WatchRepo } from "@/storage/watchRepo";
import type { ScanLogRepo } from "@/storage/scanLogRepo";
import { filterOffers, matchesKeywords } from "./matcher";
import { classifyPrice, computeMarketStats, discountPct, type DealKind } from "./market";
import type { PriceRepo } from "@/storage/priceRepo";
import {
  DEAL_SEED_LISTINGS,
  MARKET_WINDOW_DAYS,
  type MarketStats,
} from "@/shared/schemas";

export interface CheckWatchDeps {
  adapters: Record<SiteId, SiteAdapter>;
  offers: OfferRepo;
  watches: WatchRepo;
  siteHealth: SiteHealthRepo;
  rateLimiter: SiteRateLimiter;
  notifier: Notifier;
  logger: Logger;
  /** Diagnostics log; optional so tests can skip it. */
  scans?: ScanLogRepo | undefined;
  /** Deal mode's price history; without it deal mode never finds deals. */
  prices?: PriceRepo | undefined;
}

/** Deal mode searches without a price cap — it needs the whole market to
 * learn the price — and seeds its history with a full page on the first
 * (baseline) check. */
export function watchToSearchQuery(watch: Watch): SearchQuery {
  const dealMode = !!watch.deal?.enabled;
  return {
    keywords: watch.keywords,
    excludeKeywords: watch.excludeKeywords,
    priceMin: dealMode ? undefined : watch.priceMin,
    priceMax: dealMode ? undefined : watch.priceMax,
    limit: dealMode && !watch.baselineCompletedAt ? DEAL_SEED_LISTINGS : undefined,
    location: watch.location,
    condition: watch.condition,
    extra: watch.size ? { size: watch.size } : undefined,
  };
}

/**
 * One watch's full check cycle: query every selected site (isolated per
 * §7 — one adapter failing must not affect the others), match, dedupe,
 * and notify — except on the silent baseline run (uxSmartBuy.md §4 F2 /
 * startSmartBuy.md §6 rule 21), which records everything found but never
 * notifies, then marks the watch's baseline complete.
 */
export async function checkWatch(watch: Watch, deps: CheckWatchDeps): Promise<void> {
  const query = watchToSearchQuery(watch);
  const isBaseline = !watch.baselineCompletedAt;

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const perSite = await Promise.all(
    watch.sites.map(async (site) => {
      const adapter = deps.adapters[site];
      const controller = new AbortController();
      const requests: RequestTrace[] = [];
      try {
        const offers = await deps.rateLimiter.run(site, adapter.minIntervalMs, () =>
          adapter.search(query, controller.signal, (r) => requests.push(r)),
        );
        await deps.siteHealth.recordSuccess(site);
        return { site, offers, requests, error: undefined as ScanError | undefined };
      } catch (err) {
        const error = toScanError(err, SITE_ERROR_PREFIX[site]);
        await deps.siteHealth.recordError(site, error);
        deps.logger.error(`Adapter ${site} search failed [${error.code}]`, {
          watchId: watch.id,
          code: error.code,
          error: error.message,
        });
        return { site, offers: [] as NormalizedOffer[], requests, error };
      }
    }),
  );

  const allOffers = perSite.flatMap((r) => r.offers);

  let matched: NormalizedOffer[];
  const dealInfo = new Map<string, { kind: DealKind; median: number }>();
  if (watch.deal?.enabled) {
    // An auction's price is its current bid ($0.99 an hour in), not what
    // the item is worth or will sell for: it would read as a −95% "deal"
    // and drag the median down. Deal mode only looks at fixed prices.
    const relevant = allOffers.filter((o) => !o.auction && matchesKeywords(watch, o));
    let stats: MarketStats | null = null;
    if (deps.prices) {
      await deps.prices.record(watch.id, relevant);
      const history = await deps.prices.listByWatch(watch.id, MARKET_WINDOW_DAYS);
      stats = computeMarketStats(history.map((p) => p.price));
      if (stats) await deps.watches.update(watch.id, { market: stats });
    }
    matched = [];
    if (stats) {
      for (const offer of relevant) {
        const kind = classifyPrice(offer.price, stats.median, watch.deal.thresholdPct);
        if (!kind) continue;
        matched.push(offer);
        dealInfo.set(offerKey(offer), { kind, median: stats.median });
      }
    }
  } else {
    matched = filterOffers(watch, allOffers);
  }

  const foundAt = new Date().toISOString();
  const records: OfferRecord[] = matched.map((offer) =>
    OfferRecordSchema.parse({
      key: offerKey(offer),
      watchId: watch.id,
      site: offer.site,
      externalId: offer.externalId,
      url: offer.url,
      title: offer.title,
      price: offer.price,
      currency: offer.currency,
      imageUrl: offer.imageUrl,
      location: offer.location,
      postedAt: offer.postedAt,
      shippingCost: offer.shippingCost,
      auction: offer.auction,
      state: "new",
      foundAt,
      isBaseline,
      ...dealFields(offer, dealInfo.get(offerKey(offer))),
    }),
  );

  const inserted = await deps.offers.addIfNew(records);

  if (isBaseline) {
    await deps.watches.markBaselineComplete(watch.id);
  } else if (watch.deal?.enabled) {
    // Deal mode notifies only about deals — never suspiciously cheap ones.
    await deps.notifier.notifyDeals(
      watch,
      inserted.filter((o) => o.dealKind === "deal"),
    );
  } else if (inserted.length > 0) {
    await deps.notifier.notifyNewOffers(watch, inserted);
    // Immediate/daily email delivery is handled by the backend (task #9);
    // this loop only needs to have persisted the offers by then.
  }

  await deps.watches.markChecked(watch.id);

  if (deps.scans) {
    const durationMs = Date.now() - started;
    for (const r of perSite) {
      const siteMatched = matched.filter((o) => o.site === r.site).length;
      const siteInserted = inserted.filter((o) => o.site === r.site).length;
      const record: ScanRecord = {
        id: crypto.randomUUID(),
        kind: "watch",
        site: r.site,
        watchId: watch.id,
        watchName: watch.name,
        startedAt,
        durationMs,
        ok: !r.error,
        baseline: isBaseline,
        fetched: r.offers.length,
        matched: siteMatched,
        inserted: siteInserted,
        errorCode: r.error?.code,
        errorMessage: r.error?.message.slice(0, 500),
        requests: r.requests,
      };
      await deps.scans.append(record);
    }
  }
}

function dealFields(
  offer: NormalizedOffer,
  info: { kind: DealKind; median: number } | undefined,
): Partial<OfferRecord> {
  if (!info) return {};
  return {
    dealKind: info.kind,
    marketPrice: info.median,
    ...(offer.price !== null && { discountPct: discountPct(offer.price, info.median) }),
  };
}
