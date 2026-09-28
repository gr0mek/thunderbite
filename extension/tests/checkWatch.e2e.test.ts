import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdapter } from "@/adapters/fake";
import type { NormalizedOffer, SiteAdapter, SiteId } from "@/adapters/types";
import {
  createWatchAndRunBaseline,
  checkWatchNow,
  pauseWatch,
  resumeWatch,
  deleteWatch,
  type LifecycleDeps,
} from "@/core/watchLifecycle";
import { watchAlarmName } from "@/background/alarms";
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
import { openOfferDb } from "@/storage/offerDb";
import { Logger } from "@/shared/logger";

function vintedOffer(id: string, title: string): NormalizedOffer {
  return {
    site: "vinted",
    externalId: id,
    url: `https://vinted.pl/oferta/${id}`,
    title,
    price: 4200,
    currency: "PLN",
  };
}

/** End-to-end wiring test: watch creation → silent baseline → a later check
 * that finds one genuinely new offer → notification. Uses the fake adapter
 * (see adapters/fake), not a real marketplace — that part is blocked (see
 * docs/adr-001-adapter-fixture-blocker.md) until real fixtures land. */
describe("checkWatch / watchLifecycle end-to-end", () => {
  let deps: LifecycleDeps;
  let create: ReturnType<typeof vi.fn>;
  let vintedResults: NormalizedOffer[];

  beforeEach(() => {
    const root = new RootStore(new MemoryStore());
    vintedResults = [vintedOffer("1", "Leica M6 czarna"), vintedOffer("2", "Nikon FM2")];
    const adapters: Record<SiteId, SiteAdapter> = {
      vinted: createFakeAdapter("vinted", () => vintedResults),
    };
    create = vi.fn().mockResolvedValue(undefined);
    const notifications: NotificationsPort = { create };
    deps = {
      adapters,
      offers: new OfferRepo(openOfferDb(`e2e-${crypto.randomUUID()}`)),
      watches: new WatchRepo(root),
      siteHealth: new SiteHealthRepo(root),
      rateLimiter: new SiteRateLimiter(),
      notifier: new Notifier(
        notifications,
        new NotificationTargetStore(new MemoryStore()),
      ),
      logger: new Logger(new LogRepo(root)),
      siteFloorsMinutes: { vinted: 1 },
    };
  });

  it("runs a silent baseline on creation: offers are saved but nothing is notified", async () => {
    const watch = await createWatchAndRunBaseline(deps, {
      name: "Leica M6",
      keywords: ["Leica M6"],
      sites: ["vinted"],
    });

    expect(watch.baselineCompletedAt).toBeDefined();
    expect(create).not.toHaveBeenCalled();

    const saved = await deps.offers.listByWatch(watch.id);
    expect(saved).toHaveLength(1); // only the Vinted offer matching "Leica M6"
    expect(saved[0]!.isBaseline).toBe(true);

    const alarm = await chrome.alarms.get(watchAlarmName(watch.id));
    expect(alarm).toBeDefined();
  });

  it("notifies only for genuinely new offers on a later check", async () => {
    const watch = await createWatchAndRunBaseline(deps, {
      name: "Leica M6",
      keywords: ["Leica M6"],
      sites: ["vinted"],
    });
    create.mockClear();

    vintedResults = [...vintedResults, vintedOffer("3", "Leica M6 TTL 0.72")];
    await checkWatchNow(deps, watch.id);

    expect(create).toHaveBeenCalledTimes(1); // only offer "3" is new
    const saved = await deps.offers.listByWatch(watch.id);
    expect(saved).toHaveLength(2);
    expect(saved.find((o) => o.externalId === "3")!.isBaseline).toBe(false);
  });

  it("pause clears the alarm and resume reschedules it", async () => {
    const watch = await createWatchAndRunBaseline(deps, { name: "Leica M6" });
    const name = watchAlarmName(watch.id);
    expect(await chrome.alarms.get(name)).toBeDefined();

    const paused = await pauseWatch(deps, watch.id);
    expect(paused.paused).toBe(true);
    expect(await chrome.alarms.get(name)).toBeUndefined();

    const resumed = await resumeWatch(deps, watch.id);
    expect(resumed.paused).toBe(false);
    expect(await chrome.alarms.get(name)).toBeDefined();
  });

  it("delete removes the watch, its offers, and its alarm", async () => {
    const watch = await createWatchAndRunBaseline(deps, {
      name: "Leica M6",
      keywords: ["Leica M6"],
      sites: ["vinted"],
    });
    await deleteWatch(deps, watch.id);

    expect(await deps.watches.get(watch.id)).toBeUndefined();
    expect(await deps.offers.listByWatch(watch.id)).toHaveLength(0);
    expect(await chrome.alarms.get(watchAlarmName(watch.id))).toBeUndefined();
  });
});
