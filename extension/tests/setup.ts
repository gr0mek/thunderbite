// Polyfills IndexedDB for storage/offerDb.ts + offerRepo.ts tests, since
// jsdom doesn't implement it.
import "fake-indexeddb/auto";

// Minimal chrome.* stub so code that calls chrome.alarms/notifications
// directly (background/alarms.ts, background/notifier.ts's ChromeNotifications)
// can be exercised under Vitest without a real browser. Tests that care about
// specific calls read from these maps/arrays rather than mocking per-test.
const alarms = new Map<string, chrome.alarms.Alarm>();
(globalThis as unknown as { chrome: unknown }).chrome = {
  alarms: {
    create: (name: string, info: { delayInMinutes?: number }) => {
      alarms.set(name, {
        name,
        scheduledTime: Date.now() + (info.delayInMinutes ?? 0) * 60_000,
      });
      return Promise.resolve();
    },
    clear: (name: string) => {
      const existed = alarms.delete(name);
      return Promise.resolve(existed);
    },
    get: (name: string) => Promise.resolve(alarms.get(name)),
  },
  runtime: {
    getURL: (path: string) => `chrome-extension://test/${path}`,
  },
};
