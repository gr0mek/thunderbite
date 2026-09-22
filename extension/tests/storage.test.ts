import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/storage/local";
import { RootStore } from "@/storage/rootStore";
import { WatchRepo, WatchLimitReachedError } from "@/storage/watchRepo";
import { SettingsRepo } from "@/storage/settingsRepo";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";
import { OfferRepo } from "@/storage/offerRepo";
import { openOfferDb } from "@/storage/offerDb";
import { migrateStorage } from "@/storage/migrations";
import { offerKey } from "@/adapters/types";
import type { OfferRecord } from "@/shared/schemas";

describe("migrateStorage", () => {
  it("produces a valid default root from undefined (first install)", () => {
    const root = migrateStorage(undefined);
    expect(root.schemaVersion).toBe(1);
    expect(root.watches).toEqual([]);
    expect(root.settings.watchLimit).toBe(20);
  });

  it("is idempotent on an already-current root", () => {
    const first = migrateStorage(undefined);
    const second = migrateStorage(first);
    expect(second).toEqual(first);
  });
});

describe("WatchRepo", () => {
  function makeRepo() {
    const root = new RootStore(new MemoryStore());
    return { watches: new WatchRepo(root), settings: new SettingsRepo(root) };
  }

  it("fills in defaults from uxSmartBuy.md §3.1 (keywords=[name], all sites, settings defaults)", async () => {
    const { watches } = makeRepo();
    const w = await watches.create({ name: "Leica M6" });
    expect(w.keywords).toEqual(["Leica M6"]);
    expect(w.sites.sort()).toEqual(["allegro", "olx", "vinted"]);
    expect(w.checkIntervalMinutes).toBe(15);
    expect(w.notifyEmail).toBe("immediate");
    expect(w.paused).toBe(false);
  });

  it("enforces the watch limit from settings", async () => {
    const { watches, settings } = makeRepo();
    await settings.update({ watchLimit: 1 });
    await watches.create({ name: "Pierwsza" });
    await expect(watches.create({ name: "Druga" })).rejects.toBeInstanceOf(
      WatchLimitReachedError,
    );
  });

  it("pauses, marks baseline complete, and removes a watch", async () => {
    const { watches } = makeRepo();
    const w = await watches.create({ name: "Rower gravel" });
    await watches.setPaused(w.id, true);
    const baselined = await watches.markBaselineComplete(w.id);
    expect(baselined.paused).toBe(true);
    expect(baselined.baselineCompletedAt).toBeDefined();
    await watches.remove(w.id);
    expect(await watches.get(w.id)).toBeUndefined();
  });
});

describe("SiteHealthRepo", () => {
  it("degrades after 1-2 errors and breaks at 3 consecutive errors, resetting on success", async () => {
    const repo = new SiteHealthRepo(new RootStore(new MemoryStore()));
    await repo.recordError("vinted");
    expect((await repo.get("vinted")).status).toBe("degraded");
    await repo.recordError("vinted");
    expect((await repo.get("vinted")).status).toBe("degraded");
    await repo.recordError("vinted");
    expect((await repo.get("vinted")).status).toBe("broken");
    await repo.recordSuccess("vinted");
    const healthy = await repo.get("vinted");
    expect(healthy.status).toBe("ok");
    expect(healthy.consecutiveErrors).toBe(0);
  });

  it("lists all three sites even before any check ran", async () => {
    const repo = new SiteHealthRepo(new RootStore(new MemoryStore()));
    const list = await repo.list();
    expect(list.map((h) => h.site).sort()).toEqual(["allegro", "olx", "vinted"]);
    expect(list.every((h) => h.status === "ok")).toBe(true);
  });
});

const TEST_WATCH_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

describe("OfferRepo", () => {
  let repo: OfferRepo;

  beforeEach(() => {
    // Isolated DB per test avoids races on deleting/reopening a shared one.
    repo = new OfferRepo(openOfferDb(`thunder-bait-test-${crypto.randomUUID()}`));
  });

  function offer(overrides: Partial<OfferRecord> = {}): OfferRecord {
    return {
      key: offerKey({ site: "olx", externalId: overrides.externalId ?? "abc" }),
      watchId: TEST_WATCH_ID,
      site: "olx",
      externalId: "abc",
      url: "https://olx.pl/oferta/abc",
      title: "Leica M6 czarna",
      price: 4200,
      currency: "PLN",
      state: "new",
      foundAt: new Date().toISOString(),
      isBaseline: false,
      ...overrides,
    };
  }

  it("dedupes by key: re-adding the same offer is a no-op", async () => {
    const first = await repo.addIfNew([offer()]);
    expect(first).toHaveLength(1);
    const second = await repo.addIfNew([offer()]);
    expect(second).toHaveLength(0);
    expect(await repo.listByWatch(TEST_WATCH_ID)).toHaveLength(1);
  });

  it("marks all new offers for a watch as seen", async () => {
    await repo.addIfNew([offer({ externalId: "a" }), offer({ externalId: "b" })]);
    await repo.markAllSeenForWatch(TEST_WATCH_ID);
    expect(await repo.countByWatchAndState(TEST_WATCH_ID, "new")).toBe(0);
    expect(await repo.countByWatchAndState(TEST_WATCH_ID, "seen")).toBe(2);
  });

  it("purges offers older than the retention window", async () => {
    const old = offer({
      externalId: "old",
      foundAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const recent = offer({ externalId: "recent" });
    await repo.addIfNew([old, recent]);
    const deleted = await repo.deleteOlderThan(30);
    expect(deleted).toBe(1);
    const remaining = await repo.listByWatch(TEST_WATCH_ID);
    expect(remaining.map((o) => o.externalId)).toEqual(["recent"]);
  });

  it("deletes all offers for a watch", async () => {
    await repo.addIfNew([offer({ externalId: "a" })]);
    await repo.deleteByWatch(TEST_WATCH_ID);
    expect(await repo.listByWatch(TEST_WATCH_ID)).toHaveLength(0);
  });
});
