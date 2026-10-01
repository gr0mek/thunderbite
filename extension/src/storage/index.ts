import { ChromeLocalStore } from "./local";
import { RootStore } from "./rootStore";
import { WatchRepo } from "./watchRepo";
import { SettingsRepo } from "./settingsRepo";
import { SiteHealthRepo } from "./siteHealthRepo";
import { LogRepo } from "./logRepo";
import { ScanLogRepo } from "./scanLogRepo";
import { OfferRepo } from "./offerRepo";
import { openOfferDb } from "./offerDb";

/** Wires the real chrome.storage.local + IndexedDB backends together. Call
 * once per context (background, popup, options) and share the instance. */
export function createStorage() {
  const root = new RootStore(new ChromeLocalStore());
  const offerDb = openOfferDb();
  return {
    root,
    watches: new WatchRepo(root),
    settings: new SettingsRepo(root),
    siteHealth: new SiteHealthRepo(root),
    logs: new LogRepo(root),
    scans: new ScanLogRepo(root),
    offers: new OfferRepo(offerDb),
  };
}

export type Storage = ReturnType<typeof createStorage>;

export { WatchLimitReachedError } from "./watchRepo";
export { RootStore } from "./rootStore";
export { WatchRepo } from "./watchRepo";
export { SettingsRepo } from "./settingsRepo";
export { SiteHealthRepo } from "./siteHealthRepo";
export { LogRepo } from "./logRepo";
export { ScanLogRepo } from "./scanLogRepo";
export { OfferRepo, type OfferFilter } from "./offerRepo";
export { MemoryStore, ChromeLocalStore, type KeyValueStore } from "./local";
export { openOfferDb } from "./offerDb";
export { CURRENT_SCHEMA_VERSION, migrateStorage } from "./migrations";
