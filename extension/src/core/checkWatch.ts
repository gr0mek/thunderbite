import {
  offerKey,
  type NormalizedOffer,
  type SearchQuery,
  type SiteAdapter,
  type SiteId,
} from "@/adapters/types";
import { OfferRecordSchema, type OfferRecord, type Watch } from "@/shared/schemas";
import type { Notifier } from "@/background/notifier";
import type { SiteRateLimiter } from "@/background/rateLimiter";
import type { Logger } from "@/shared/logger";
import type { OfferRepo } from "@/storage/offerRepo";
import type { SiteHealthRepo } from "@/storage/siteHealthRepo";
import type { WatchRepo } from "@/storage/watchRepo";
import { filterOffers } from "./matcher";

export interface CheckWatchDeps {
  adapters: Record<SiteId, SiteAdapter>;
  offers: OfferRepo;
  watches: WatchRepo;
  siteHealth: SiteHealthRepo;
  rateLimiter: SiteRateLimiter;
  notifier: Notifier;
  logger: Logger;
}

export function watchToSearchQuery(watch: Watch): SearchQuery {
  return {
    keywords: watch.keywords,
    excludeKeywords: watch.excludeKeywords,
    priceMin: watch.priceMin,
    priceMax: watch.priceMax,
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

  const perSite = await Promise.allSettled(
    watch.sites.map(async (site): Promise<NormalizedOffer[]> => {
      const adapter = deps.adapters[site];
      const controller = new AbortController();
      try {
        const offers = await deps.rateLimiter.run(site, adapter.minIntervalMs, () =>
          adapter.search(query, controller.signal),
        );
        await deps.siteHealth.recordSuccess(site);
        return offers;
      } catch (err) {
        await deps.siteHealth.recordError(site);
        deps.logger.error(`Adapter ${site} search failed`, {
          watchId: watch.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }
    }),
  );

  const allOffers = perSite.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const matched = filterOffers(watch, allOffers);

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
      state: "new",
      foundAt,
      isBaseline,
    }),
  );

  const inserted = await deps.offers.addIfNew(records);

  if (isBaseline) {
    await deps.watches.markBaselineComplete(watch.id);
  } else if (inserted.length > 0) {
    await deps.notifier.notifyNewOffers(watch, inserted);
    // Immediate/daily email delivery is handled by the backend (task #9);
    // this loop only needs to have persisted the offers by then.
  }

  await deps.watches.markChecked(watch.id);
}
