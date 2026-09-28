import { copy } from "@/shared/copy.pl";
import { NewWatchInputSchema, WatchSchema, type Watch } from "@/shared/schemas";
import type { RootStore } from "./rootStore";

export class WatchLimitReachedError extends Error {
  constructor(readonly limit: number) {
    // §6 "Limit" banner copy doubles as the error message shown in the
    // create-watch form, so both surfaces say the exact same thing.
    super(copy.banners.watchLimitReached(limit));
    this.name = "WatchLimitReachedError";
  }
}

const ALL_SITES = ["vinted"] as const;

export class WatchRepo {
  constructor(private readonly root: RootStore) {}

  async list(): Promise<Watch[]> {
    return (await this.root.read()).watches;
  }

  async get(id: string): Promise<Watch | undefined> {
    return (await this.list()).find((w) => w.id === id);
  }

  /** Applies uxSmartBuy.md §3.1 defaults for anything the caller left out. */
  async create(input: unknown): Promise<Watch> {
    const parsedInput = NewWatchInputSchema.parse(input);
    const state = await this.root.read();
    if (state.watches.length >= state.settings.watchLimit) {
      throw new WatchLimitReachedError(state.settings.watchLimit);
    }

    const now = new Date().toISOString();
    const watch = WatchSchema.parse({
      ...parsedInput,
      id: crypto.randomUUID(),
      keywords: parsedInput.keywords?.length ? parsedInput.keywords : [parsedInput.name],
      sites: parsedInput.sites?.length ? parsedInput.sites : [...ALL_SITES],
      checkIntervalMinutes:
        parsedInput.checkIntervalMinutes ?? state.settings.defaultCheckIntervalMinutes,
      notifyEmail: parsedInput.notifyEmail ?? state.settings.defaultEmailMode,
      createdAt: now,
      updatedAt: now,
    });

    await this.root.write({ ...state, watches: [...state.watches, watch] });
    return watch;
  }

  async update(
    id: string,
    patch: Partial<Omit<Watch, "id" | "createdAt">>,
  ): Promise<Watch> {
    const state = await this.root.read();
    const idx = state.watches.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Watch not found: ${id}`);

    const updated = WatchSchema.parse({
      ...state.watches[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    const watches = [...state.watches];
    watches[idx] = updated;
    await this.root.write({ ...state, watches });
    return updated;
  }

  async setPaused(id: string, paused: boolean): Promise<Watch> {
    return this.update(id, { paused });
  }

  async markBaselineComplete(id: string): Promise<Watch> {
    return this.update(id, { baselineCompletedAt: new Date().toISOString() });
  }

  async markChecked(id: string): Promise<Watch> {
    return this.update(id, { lastCheckedAt: new Date().toISOString() });
  }

  async remove(id: string): Promise<void> {
    const state = await this.root.read();
    await this.root.write({
      ...state,
      watches: state.watches.filter((w) => w.id !== id),
    });
  }
}
