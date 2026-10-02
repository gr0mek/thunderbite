// Thin, testable wrapper over chrome.storage.local so repos below don't
// each reimplement get/set — and so tests can swap in an in-memory fake.

export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export class ChromeLocalStore implements KeyValueStore {
  async get<T>(key: string): Promise<T | undefined> {
    const result = await chrome.storage.local.get(key);
    return result[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}

/** In-memory fake for unit tests — chrome.storage.local isn't available under Vitest/jsdom. */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

/**
 * chrome.storage.session: survives service-worker restarts but not a
 * browser restart, and is never written to disk — right for short-lived
 * secrets like an API access token. Falls back to memory where it's missing.
 */
export class ChromeSessionStore implements KeyValueStore {
  private readonly fallback = new MemoryStore();

  private get area(): chrome.storage.StorageArea | undefined {
    return typeof chrome !== "undefined" ? chrome.storage?.session : undefined;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const area = this.area;
    if (!area) return this.fallback.get<T>(key);
    const result = await area.get(key);
    return result[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const area = this.area;
    if (!area) return this.fallback.set(key, value);
    await area.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    const area = this.area;
    if (!area) return this.fallback.remove(key);
    await area.remove(key);
  }
}
