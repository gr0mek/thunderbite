import { OfferRecordSchema, type OfferRecord } from "@/shared/schemas";
import type { IDBPDatabase } from "idb";
import type { ThunderBaitDB } from "./offerDb";

export type OfferFilter = "new" | "seen" | "hidden" | "all";

export class OfferRepo {
  constructor(private readonly dbPromise: Promise<IDBPDatabase<ThunderBaitDB>>) {}

  /**
   * Inserts offers whose dedup key isn't already known and leaves existing
   * ones untouched (§5: "Zmiana ceny dla znanego klucza = zdarzenie
   * price_changed, nie new_offer" — price updates are handled separately by
   * the matcher, not here). Returns only the ones that were actually new,
   * since that's what the caller needs to decide whether to notify.
   */
  async addIfNew(offers: OfferRecord[]): Promise<OfferRecord[]> {
    const db = await this.dbPromise;
    const tx = db.transaction("offers", "readwrite");
    const inserted: OfferRecord[] = [];
    for (const candidate of offers) {
      const offer = OfferRecordSchema.parse(candidate);
      const existing = await tx.store.get(offer.key);
      if (!existing) {
        await tx.store.put(offer);
        inserted.push(offer);
      }
    }
    await tx.done;
    return inserted;
  }

  async listByWatch(
    watchId: string,
    filter: OfferFilter = "all",
  ): Promise<OfferRecord[]> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex("offers", "byWatch", watchId);
    const sorted = all.sort((a, b) => b.foundAt.localeCompare(a.foundAt));
    return filter === "all" ? sorted : sorted.filter((o) => o.state === filter);
  }

  async countByWatchAndState(
    watchId: string,
    state: OfferRecord["state"],
  ): Promise<number> {
    const db = await this.dbPromise;
    return db.countFromIndex("offers", "byWatchAndState", [watchId, state]);
  }

  async setState(key: string, state: OfferRecord["state"]): Promise<void> {
    const db = await this.dbPromise;
    const offer = await db.get("offers", key);
    if (!offer) return;
    await db.put("offers", { ...offer, state });
  }

  async markAllSeenForWatch(watchId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("offers", "readwrite");
    const index = tx.store.index("byWatchAndState");
    for await (const cursor of index.iterate([watchId, "new"])) {
      await cursor.update({ ...cursor.value, state: "seen" });
    }
    await tx.done;
  }

  async deleteByWatch(watchId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("offers", "readwrite");
    const index = tx.store.index("byWatch");
    for await (const cursor of index.iterate(watchId)) {
      await cursor.delete();
    }
    await tx.done;
  }

  /** uxSmartBuy.md §3.2: offers older than the retention window are purged automatically. */
  async deleteOlderThan(retentionDays: number, now = new Date()): Promise<number> {
    const db = await this.dbPromise;
    const cutoff = new Date(
      now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const tx = db.transaction("offers", "readwrite");
    const index = tx.store.index("byFoundAt");
    const range = IDBKeyRange.upperBound(cutoff);
    let deleted = 0;
    for await (const cursor of index.iterate(range)) {
      await cursor.delete();
      deleted++;
    }
    await tx.done;
    return deleted;
  }

  async deleteAll(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear("offers");
  }
}
