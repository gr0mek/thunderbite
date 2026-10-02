import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdapter, createUnconfiguredAdapter } from "@/adapters/fake";
import type { NormalizedOffer, SearchQuery } from "@/adapters/types";
import {
  classifyPrice,
  computeMarketStats,
  dealThreshold,
  discountPct,
} from "@/core/market";
import { matchesKeywords, normalizeForMatch } from "@/core/matcher";
import { watchToSearchQuery } from "@/core/checkWatch";
import {
  checkWatchNow,
  createWatchAndRunBaseline,
  deleteWatch,
  updateWatchAndReschedule,
  type LifecycleDeps,
} from "@/core/watchLifecycle";
import {
  Notifier,
  NotificationTargetStore,
  type NotificationsPort,
} from "@/background/notifier";
import { SiteRateLimiter } from "@/background/rateLimiter";
import { MemoryStore } from "@/storage/local";
import { RootStore } from "@/storage/rootStore";
import { WatchRepo } from "@/storage/watchRepo";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";
import { LogRepo } from "@/storage/logRepo";
import { OfferRepo } from "@/storage/offerRepo";
import { PriceRepo } from "@/storage/priceRepo";
import { openOfferDb } from "@/storage/offerDb";
import { Logger } from "@/shared/logger";
import { WatchSchema } from "@/shared/schemas";

describe("computeMarketStats", () => {
  it("needs a minimum sample", () => {
    expect(computeMarketStats([100, 200, 300])).toBeNull();
  });

  it("uses the median, robust to outliers", () => {
    const prices = [1800, 1900, 1950, 2000, 2100, 1850, 2050, 1990, 1920, 50, 9000];
    const stats = computeMarketStats(prices)!;
    expect(stats.median).toBe(1950);
    expect(stats.sampleSize).toBe(11);
    expect(stats.p25).toBeLessThan(stats.median);
    expect(stats.p75).toBeGreaterThan(stats.median);
  });
});

describe("classifyPrice", () => {
  it("splits deals, suspicious offers and the rest", () => {
    expect(dealThreshold(1950, 50)).toBe(975);
    expect(classifyPrice(975, 1950, 50)).toBe("deal");
    expect(classifyPrice(300, 1950, 50)).toBe("deal");
    expect(classifyPrice(976, 1950, 50)).toBeNull();
    expect(classifyPrice(150, 1950, 50)).toBe("suspicious"); // < 10%
    expect(classifyPrice(null, 1950, 50)).toBeNull();
    expect(discountPct(300, 1950)).toBe(85);
  });
});

describe("normalizeForMatch", () => {
  it("treats model-name spellings alike", () => {
    const variants = [
      "Olympus Mju-II",
      "olympus mju:ii",
      "Olympus μ-II",
      "OLYMPUS MJU 2",
    ];
    for (const v of variants) expect(normalizeForMatch(v)).toBe("olympus mju 2");
  });

  it("still matches substrings and Polish diacritics", () => {
    expect(
      matchesKeywords(
        { keywords: ["mju ii"], excludeKeywords: [] },
        { title: "Aparat Olympus mju-2 zoom" },
      ),
    ).toBe(true);
    expect(
      matchesKeywords({ keywords: ["kurtk"], excludeKeywords: [] }, { title: "Kurtka" }),
    ).toBe(true);
    expect(
      matchesKeywords(
        { keywords: ["mju ii"], excludeKeywords: ["na części"] },
        { title: "Olympus mju II na czesci" },
      ),
    ).toBe(false);
  });
});

describe("deal mode settings", () => {
  const base = {
    id: crypto.randomUUID(),
    name: "mju",
    keywords: ["mju"],
    sites: ["vinted"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("allows 2-minute checks only in deal mode", () => {
    expect(WatchSchema.safeParse({ ...base, checkIntervalMinutes: 2 }).success).toBe(
      false,
    );
    expect(
      WatchSchema.safeParse({ ...base, checkIntervalMinutes: 2, deal: { enabled: true } })
        .success,
    ).toBe(true);
  });

  it("searches without a price cap and seeds with a full page", () => {
    const watch = WatchSchema.parse({
      ...base,
      checkIntervalMinutes: 2,
      priceMax: 500,
      deal: { enabled: true },
    });
    expect(watchToSearchQuery(watch)).toMatchObject({ priceMax: undefined, limit: 96 });
    expect(
      watchToSearchQuery({ ...watch, baselineCompletedAt: new Date().toISOString() })
        .limit,
    ).toBeUndefined();
  });
});

function listing(id: string, price: number, title = "Olympus mju II"): NormalizedOffer {
  return {
    site: "vinted",
    externalId: id,
    url: `https://www.vinted.pl/items/${id}`,
    title,
    price,
    currency: "PLN",
  };
}

/** 12 normal market listings around 1 950 zł. */
const MARKET = [
  1800, 1850, 1900, 1920, 1950, 1950, 1980, 2000, 2050, 2100, 2200, 1700,
].map((p, i) => listing(`m${i}`, p));

describe("deal mode end-to-end", () => {
  let deps: LifecycleDeps;
  let create: ReturnType<typeof vi.fn>;
  let results: NormalizedOffer[];
  let lastQuery: SearchQuery | undefined;

  beforeEach(() => {
    const root = new RootStore(new MemoryStore());
    const db = openOfferDb(`deal-${crypto.randomUUID()}`);
    results = [...MARKET];
    const fake = createFakeAdapter("vinted", () => results);
    create = vi.fn().mockResolvedValue(undefined);
    const notifications: NotificationsPort = { create };
    deps = {
      adapters: {
        vinted: {
          ...fake,
          search: (q, s, o) => {
            lastQuery = q;
            return fake.search(q, s, o);
          },
        },
        ebay: createUnconfiguredAdapter("ebay"),
      },
      offers: new OfferRepo(db),
      prices: new PriceRepo(db),
      watches: new WatchRepo(root),
      siteHealth: new SiteHealthRepo(root),
      rateLimiter: new SiteRateLimiter(),
      notifier: new Notifier(
        notifications,
        new NotificationTargetStore(new MemoryStore()),
      ),
      logger: new Logger(new LogRepo(root)),
      siteFloorsMinutes: { vinted: 1, ebay: 1 },
    };
  });

  it("learns the market on baseline, then notifies only real deals", async () => {
    const watch = await createWatchAndRunBaseline(deps, {
      name: "Olympus mju II",
      checkIntervalMinutes: 2,
      deal: { enabled: true, thresholdPct: 50 },
      excludeKeywords: ["etui"],
    });
    expect(lastQuery?.limit).toBe(96);
    expect(watch.market?.median).toBe(1950);
    expect(create).not.toHaveBeenCalled();

    results = [
      ...MARKET,
      listing("deal", 300, "Olympus mju II czarny, działa"),
      listing("cheap", 100, "Olympus mju II"), // suspicious: < 10% of median
      listing("normal", 1500, "Olympus mju II"), // not a deal
      listing("case", 60, "Olympus mju II etui"), // excluded word
    ];
    await checkWatchNow(deps, watch.id);

    const offers = await deps.offers.listByWatch(watch.id);
    const byId = new Map(offers.map((o) => [o.externalId, o]));
    expect(byId.get("deal")).toMatchObject({
      dealKind: "deal",
      // The cheap listings join the history too; the median barely moves.
      discountPct: 84,
      marketPrice: 1920,
    });
    expect(byId.get("cheap")?.dealKind).toBe("suspicious");
    expect(byId.has("normal")).toBe(false);
    expect(byId.has("case")).toBe(false);

    expect(create).toHaveBeenCalledTimes(1);
    const [, opts] = create.mock.calls[0]!;
    expect(opts.title).toBe("🔥 300 zł · Olympus mju II czarny, działa");
    expect(opts.message).toContain("−84%");
    expect(opts.requireInteraction).toBe(true);
  });

  it("stays quiet while it has too few prices to trust", async () => {
    results = MARKET.slice(0, 5);
    const watch = await createWatchAndRunBaseline(deps, {
      name: "Olympus mju II",
      checkIntervalMinutes: 2,
      deal: { enabled: true },
    });
    expect(watch.market).toBeUndefined();
    results = [...MARKET.slice(0, 5), listing("deal", 300)];
    await checkWatchNow(deps, watch.id);
    expect(create).not.toHaveBeenCalled();
  });

  it("relearns when deal mode is switched on later, and cleans up on delete", async () => {
    const watch = await createWatchAndRunBaseline(deps, { name: "Olympus mju II" });
    expect(await deps.prices!.listByWatch(watch.id, 30)).toHaveLength(0);

    const updated = await updateWatchAndReschedule(deps, watch.id, {
      deal: { enabled: true, thresholdPct: 50 },
      checkIntervalMinutes: 2,
    });
    expect(updated.market?.median).toBe(1950);
    expect(await deps.prices!.listByWatch(watch.id, 30)).toHaveLength(MARKET.length);

    await deleteWatch(deps, watch.id);
    expect(await deps.prices!.listByWatch(watch.id, 30)).toHaveLength(0);
  });
});

describe("deal mode on eBay", () => {
  function ebayListing(
    id: string,
    price: number,
    extra: Partial<NormalizedOffer> = {},
  ): NormalizedOffer {
    return {
      site: "ebay",
      externalId: id,
      url: `https://www.ebay.com/itm/${id}`,
      title: "Olympus mju II",
      price,
      currency: "USD",
      ...extra,
    };
  }

  it("ignores auctions and notifies fixed-price deals in dollars", async () => {
    const root = new RootStore(new MemoryStore());
    const db = openOfferDb(`deal-ebay-${crypto.randomUUID()}`);
    const market = [400, 420, 450, 460, 480, 500, 500, 510, 520, 540, 560, 600].map(
      (p, i) => ebayListing(`m${i}`, p),
    );
    // A fresh auction at $1 would otherwise look like a −99% bargain.
    let results = [...market, ebayListing("auction", 1, { auction: { bidCount: 0 } })];
    const create = vi.fn().mockResolvedValue(undefined);
    const deps: LifecycleDeps = {
      adapters: {
        vinted: createUnconfiguredAdapter("vinted"),
        ebay: createFakeAdapter("ebay", () => results),
      },
      offers: new OfferRepo(db),
      prices: new PriceRepo(db),
      watches: new WatchRepo(root),
      siteHealth: new SiteHealthRepo(root),
      rateLimiter: new SiteRateLimiter(),
      notifier: new Notifier({ create }, new NotificationTargetStore(new MemoryStore())),
      logger: new Logger(new LogRepo(root)),
      siteFloorsMinutes: { vinted: 1, ebay: 1 },
    };

    const watch = await createWatchAndRunBaseline(deps, {
      name: "Olympus mju II",
      sites: ["ebay"],
      checkIntervalMinutes: 2,
      deal: { enabled: true, thresholdPct: 50 },
    });
    expect(watch.market?.median).toBe(500);
    expect(await deps.prices!.listByWatch(watch.id, 30)).toHaveLength(market.length);

    results = [
      ...market,
      ebayListing("auction2", 20, { auction: { bidCount: 3 } }),
      ebayListing("deal", 200, { shippingCost: 25 }),
    ];
    await checkWatchNow(deps, watch.id);

    const offers = await deps.offers.listByWatch(watch.id);
    expect(offers.map((o) => o.externalId)).toEqual(["deal"]);
    expect(offers[0]).toMatchObject({
      currency: "USD",
      shippingCost: 25,
      dealKind: "deal",
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1].title).toBe("🔥 $200 · Olympus mju II");
    expect(create.mock.calls[0]![1].message).toContain("mediana $500 · eBay");
  });
});
