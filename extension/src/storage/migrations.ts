import { StorageRootSchema, type StorageRoot } from "@/shared/schemas";

// Versioned storage migrations — startSmartBuy.md §7 ("Migracje storage
// wersjonowane, żeby aktualizacja rozszerzenia nie gubiła watchlisty").
//
// Add a new migration by bumping CURRENT_SCHEMA_VERSION and adding a
// `[CURRENT_SCHEMA_VERSION]: (prev) => next` entry below. Migrations run
// sequentially from whatever version is on disk up to current, so never
// remove or renumber an old entry.

export const CURRENT_SCHEMA_VERSION = 1;

type Migration = (previous: Record<string, unknown>) => Record<string, unknown>;

const MIGRATIONS: Record<number, Migration> = {
  // 1 is the initial shape — no migration needed to reach it.
};

function emptyRoot(): Record<string, unknown> {
  return { schemaVersion: 0, watches: [], settings: {}, siteHealth: [], logs: [] };
}

/**
 * Runs whatever migrations are needed to bring `raw` (as read straight from
 * chrome.storage.local, or `undefined` on first install) up to
 * CURRENT_SCHEMA_VERSION, then validates the result. Throws if the final
 * shape still doesn't validate — callers should treat that as corrupt
 * storage, not silently coerce it.
 */
export function migrateStorage(raw: unknown): StorageRoot {
  let data: Record<string, unknown> =
    raw && typeof raw === "object"
      ? { ...(raw as Record<string, unknown>) }
      : emptyRoot();

  let version = typeof data.schemaVersion === "number" ? data.schemaVersion : 0;
  while (version < CURRENT_SCHEMA_VERSION) {
    const next = version + 1;
    const migrate = MIGRATIONS[next];
    data = migrate ? migrate(data) : data;
    data.schemaVersion = next;
    version = next;
  }

  return StorageRootSchema.parse(data);
}
