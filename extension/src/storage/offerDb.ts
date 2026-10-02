import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OfferRecord, PricePoint } from "@/shared/schemas";

interface ThunderBaitDB extends DBSchema {
  offers: {
    key: string; // `${site}:${externalId}`, see adapters/types.ts#offerKey
    value: OfferRecord;
    indexes: {
      byWatch: string;
      byWatchAndState: [string, string];
      byFoundAt: string;
    };
  };
  /** Deal mode's price history: every relevant listing a watch has seen. */
  prices: {
    key: string; // `${watchId}:${externalId}`
    value: PricePoint;
    indexes: {
      byWatch: string;
      byLastSeenAt: string;
    };
  };
}

const DB_NAME = "thunder-bait";
const DB_VERSION = 2;

/** `name` is overridable so tests can use an isolated database per test
 * instead of racing shared state through delete-and-reopen. */
export function openOfferDb(name = DB_NAME): Promise<IDBPDatabase<ThunderBaitDB>> {
  return openDB<ThunderBaitDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore("offers", { keyPath: "key" });
        store.createIndex("byWatch", "watchId");
        store.createIndex("byWatchAndState", ["watchId", "state"]);
        store.createIndex("byFoundAt", "foundAt");
      }
      if (oldVersion < 2) {
        const prices = db.createObjectStore("prices", { keyPath: "key" });
        prices.createIndex("byWatch", "watchId");
        prices.createIndex("byLastSeenAt", "lastSeenAt");
      }
    },
  });
}

export type { ThunderBaitDB };
