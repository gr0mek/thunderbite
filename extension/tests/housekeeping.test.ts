import { beforeEach, describe, expect, it } from "vitest";
import { runHousekeeping } from "@/background/housekeeping";
import type { AdapterHealth, SiteAdapter, SiteId } from "@/adapters/types";
import { offerKey } from "@/adapters/types";
import { Logger } from "@/shared/logger";
import { LogRepo } from "@/storage/logRepo";
import { RootStore } from "@/storage/rootStore";
import { MemoryStore } from "@/storage/local";
import { SettingsRepo } from "@/storage/settingsRepo";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";
import { OfferRepo } from "@/storage/offerRepo";
import { openOfferDb } from "@/storage/offerDb";
import type { OfferRecord } from "@/shared/schemas";

function okAdapter(): SiteAdapter {
  return {
    id: "olx",
    minIntervalMs: 1,
    search: async () => [],
    healthCheck: async (): Promise<AdapterHealth> => "ok",
  };
}

const WATCH_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";

function offer(id: string, foundAt: string): OfferRecord {
  return {
    key: offerKey({ site: "olx", externalId: id }),
    watchId: WATCH_ID,
    site: "olx",
    externalId: id,
    url: `https://olx.pl/oferta/${id}`,
    title: "Leica M6",
    price: 4200,
    currency: "PLN",
    state: "new",
    foundAt,
    isBaseline: false,
  };
}

describe("runHousekeeping", () => {
  let root: RootStore;
  let offers: OfferRepo;

  beforeEach(() => {
    root = new RootStore(new MemoryStore());
    offers = new OfferRepo(openOfferDb(`housekeeping-${crypto.randomUUID()}`));
  });

  it("runs health checks and purges offers past the configured retention window", async () => {
    const settings = new SettingsRepo(root);
    await settings.update({ offerRetentionDays: 30 });

    const old = offer(
      "old",
      new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const recent = offer("recent", new Date().toISOString());
    await offers.addIfNew([old, recent]);

    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));
    const adapters: Record<SiteId, SiteAdapter> = {
      olx: okAdapter(),
      vinted: okAdapter(),
      allegro: okAdapter(),
    };

    await runHousekeeping({ adapters, siteHealth, offers, settings, logger });

    const remaining = await offers.listByWatch(WATCH_ID);
    expect(remaining.map((o) => o.externalId)).toEqual(["recent"]);
    expect((await siteHealth.get("olx")).status).toBe("ok");
  });
});
