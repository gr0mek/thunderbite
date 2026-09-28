import { describe, expect, it, vi } from "vitest";
import {
  Notifier,
  NotificationTargetStore,
  type NotificationsPort,
} from "@/background/notifier";
import { MemoryStore } from "@/storage/local";
import type { OfferRecord, Watch } from "@/shared/schemas";

const WATCH: Watch = {
  id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  name: "Leica M6",
  keywords: ["Leica M6"],
  excludeKeywords: [],
  sites: ["vinted"],
  condition: "any",
  checkIntervalMinutes: 15,
  notifyBrowser: true,
  notifyEmail: "immediate",
  paused: false,
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

function offer(overrides: Partial<OfferRecord> = {}): OfferRecord {
  return {
    key: `vinted:${overrides.externalId ?? "1"}`,
    watchId: WATCH.id,
    site: "vinted",
    externalId: "1",
    url: "https://vinted.pl/oferta/1",
    title: "Leica M6 czarna",
    price: 4200,
    currency: "PLN",
    state: "new",
    foundAt: "2026-09-22T00:00:00.000Z",
    isBaseline: false,
    ...overrides,
  };
}

function makeNotifier() {
  const create = vi.fn().mockResolvedValue(undefined);
  const notifications: NotificationsPort = { create };
  const targets = new NotificationTargetStore(new MemoryStore());
  return { notifier: new Notifier(notifications, targets), create, targets };
}

describe("Notifier", () => {
  it("does nothing for an empty offer list", async () => {
    const { notifier, create } = makeNotifier();
    await notifier.notifyNewOffers(WATCH, []);
    expect(create).not.toHaveBeenCalled();
  });

  it("sends one notification per offer when there are 3 or fewer (§6 rule 20)", async () => {
    const { notifier, create, targets } = makeNotifier();
    const offers = [offer({ externalId: "1" }), offer({ externalId: "2" })];
    await notifier.notifyNewOffers(WATCH, offers);
    expect(create).toHaveBeenCalledTimes(2);
    const [firstId, firstOptions] = create.mock.calls[0]!;
    expect(firstOptions.title).toContain("4 200 zł");
    expect(firstOptions.title).toContain("Leica M6 czarna");
    const target = await targets.take(firstId);
    expect(target).toEqual({ type: "offer", offerKey: "vinted:1", url: offers[0]!.url });
  });

  it("groups into a single notification when there are more than 3", async () => {
    const { notifier, create, targets } = makeNotifier();
    const offers = [1, 2, 3, 4].map((n) =>
      offer({ externalId: String(n), price: 1000 * n }),
    );
    await notifier.notifyNewOffers(WATCH, offers);
    expect(create).toHaveBeenCalledTimes(1);
    const [groupId, options] = create.mock.calls[0]!;
    expect(options.title).toBe("4 nowych ofert · Leica M6");
    expect(options.message).toContain("1 000 zł");
    const target = await targets.take(groupId);
    expect(target).toEqual({ type: "grouped", watchId: WATCH.id });
  });
});
