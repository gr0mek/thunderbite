import { StorageRootSchema, type StorageRoot } from "@/shared/schemas";
import { migrateStorage } from "./migrations";
import type { KeyValueStore } from "./local";

const ROOT_KEY = "tb:root";

/**
 * Single source of truth for everything in chrome.storage.local. Reads run
 * the migration chain and validate with Zod (§6 rule 17: "MUST walidować
 * Zodem wszystkie dane"); writes validate before persisting so a bug can't
 * silently corrupt storage on disk.
 */
export class RootStore {
  constructor(private readonly kv: KeyValueStore) {}

  async read(): Promise<StorageRoot> {
    const raw = await this.kv.get<unknown>(ROOT_KEY);
    return migrateStorage(raw);
  }

  async write(root: StorageRoot): Promise<void> {
    const validated = StorageRootSchema.parse(root);
    await this.kv.set(ROOT_KEY, validated);
  }

  /** Read-modify-write; NOT atomic against concurrent callers (fine for a
   * single popup/options/background context talking to one storage area —
   * chrome.storage.local writes are serialized per extension). */
  async update(fn: (root: StorageRoot) => StorageRoot): Promise<StorageRoot> {
    const next = fn(await this.read());
    await this.write(next);
    return next;
  }
}
