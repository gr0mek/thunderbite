import type { IDBPDatabase } from "idb";
import type { NormalizedOffer } from "@/adapters/types";
import { PricePointSchema, type PricePoint } from "@/shared/schemas";
import type { ThunderBaitDB } from "./offerDb";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Deal mode's per-watch price history — one entry per listing, updated
 * (price, lastSeenAt) every time a scan sees it again. */
export class PriceRepo {
  constructor(private readonly dbPromise: Promise<IDBPDatabase<ThunderBaitDB>>) {}

  async record(
    watchId: string,
    offers: NormalizedOffer[],
    now = new Date(),
  ): Promise<void> {
    const priced = offers.filter(
      (o): o is NormalizedOffer & { price: number } => typeof o.price === "number",
    );
    if (priced.length === 0) return;
    const db = await this.dbPromise;
    const tx = db.transaction("prices", "readwrite");
    const at = now.toISOString();
    for (const offer of priced) {
      const key = `${watchId}:${offer.externalId}`;
      const existing = await tx.store.get(key);
      await tx.store.put(
        PricePointSchema.parse({
          key,
          watchId,
          externalId: offer.externalId,
          price: offer.price,
          title: offer.title,
          url: offer.url,
          firstSeenAt: existing?.firstSeenAt ?? at,
          lastSeenAt: at,
        }),
      );
    }
    await tx.done;
  }

  /** Listings seen within the last `days` days, oldest first. */
  async listByWatch(
    watchId: string,
    days: number,
    now = new Date(),
  ): Promise<PricePoint[]> {
    const db = await this.dbPromise;
    const cutoff = new Date(now.getTime() - days * DAY_MS).toISOString();
    const all = await db.getAllFromIndex("prices", "byWatch", watchId);
    return all
      .filter((p) => p.lastSeenAt >= cutoff)
      .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt));
  }

  async deleteByWatch(watchId: string): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction("prices", "readwrite");
    for await (const cursor of tx.store.index("byWatch").iterate(watchId)) {
      await cursor.delete();
    }
    await tx.done;
  }

  async deleteOlderThan(days: number, now = new Date()): Promise<number> {
    const db = await this.dbPromise;
    const cutoff = new Date(now.getTime() - days * DAY_MS).toISOString();
    const tx = db.transaction("prices", "readwrite");
    let deleted = 0;
    for await (const cursor of tx.store
      .index("byLastSeenAt")
      .iterate(IDBKeyRange.upperBound(cutoff, true))) {
      await cursor.delete();
      deleted++;
    }
    await tx.done;
    return deleted;
  }

  async deleteAll(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear("prices");
  }
}
