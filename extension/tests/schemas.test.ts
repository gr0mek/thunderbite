import { describe, expect, it } from "vitest";
import {
  OfferRecordSchema,
  SettingsSchema,
  WatchSchema,
  MIN_CHECK_INTERVAL_MINUTES,
} from "@/shared/schemas";
import { offerKey } from "@/adapters/types";

const baseWatch = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  name: "Leica M6",
  keywords: ["Leica M6"],
  sites: ["vinted"] as const,
  checkIntervalMinutes: 15,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

describe("WatchSchema", () => {
  it("accepts a minimal valid watch and fills in defaults", () => {
    const w = WatchSchema.parse(baseWatch);
    expect(w.excludeKeywords).toEqual([]);
    expect(w.condition).toBe("any");
    expect(w.notifyBrowser).toBe(true);
    expect(w.notifyEmail).toBe("immediate");
    expect(w.paused).toBe(false);
  });

  it("rejects priceMin > priceMax", () => {
    expect(() =>
      WatchSchema.parse({ ...baseWatch, priceMin: 500, priceMax: 100 }),
    ).toThrow();
  });

  it("rejects an interval below the hard floor", () => {
    expect(() =>
      WatchSchema.parse({
        ...baseWatch,
        checkIntervalMinutes: MIN_CHECK_INTERVAL_MINUTES - 1,
      }),
    ).toThrow();
  });

  it("rejects an empty sites list", () => {
    expect(() => WatchSchema.parse({ ...baseWatch, sites: [] })).toThrow();
  });
});

describe("OfferRecordSchema", () => {
  it("derives the same key as offerKey()", () => {
    const offer = OfferRecordSchema.parse({
      key: offerKey({ site: "vinted", externalId: "abc123" }),
      watchId: baseWatch.id,
      site: "vinted",
      externalId: "abc123",
      url: "https://vinted.pl/oferta/abc123",
      title: "Leica M6 czarna",
      price: 4200,
      currency: "PLN",
      foundAt: "2026-09-22T00:00:00.000Z",
    });
    expect(offer.key).toBe("vinted:abc123");
    expect(offer.state).toBe("new");
    expect(offer.isBaseline).toBe(false);
  });
});

describe("SettingsSchema", () => {
  it("applies the confirmed §12 defaults", () => {
    const s = SettingsSchema.parse({});
    expect(s.watchLimit).toBe(20);
    expect(s.offerRetentionDays).toBe(30);
    expect(s.digestHour).toBe("08:00");
    expect(s.defaultCheckIntervalMinutes).toBe(15);
  });

  it("rejects a malformed digest hour", () => {
    expect(() => SettingsSchema.parse({ digestHour: "8:00" })).toThrow();
  });
});
