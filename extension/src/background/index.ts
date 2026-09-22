// Service worker entry point. Listeners MUST be registered synchronously at
// the top level (startSmartBuy.md §6 rule 7) — the worker can be killed and
// restarted between events, so nothing here may depend on module-level state
// surviving between calls; everything that needs to survive goes through
// `deps`, which is cheap to rebuild on every wake-up.

import { createFakeAdapter } from "@/adapters/fake";
import type { SiteAdapter, SiteId } from "@/adapters/types";
import { checkWatch } from "@/core/checkWatch";
import {
  createWatchAndRunBaseline,
  checkWatchNow as runCheckWatchNow,
  pauseWatch as runPauseWatch,
  resumeWatch as runResumeWatch,
  deleteWatch as runDeleteWatch,
  type LifecycleDeps,
} from "@/core/watchLifecycle";
import type { BackgroundRequest, BackgroundResponse } from "./messages";
import {
  clearWatchAlarm,
  effectiveIntervalMinutes,
  jitteredDelayMinutes,
  parseWatchIdFromAlarm,
  scheduleWatchAlarm,
} from "./alarms";
import { ChromeNotifications, NotificationTargetStore, Notifier } from "./notifier";
import { SiteRateLimiter } from "./rateLimiter";
import { ChromeLocalStore } from "@/storage/local";
import { createStorage } from "@/storage";

// TODO(#6-#8): swap these for the real OLX/Vinted/Allegro adapters once
// fixtures are available — see docs/adr-001-adapter-fixture-blocker.md.
// Everything downstream only depends on the SiteAdapter interface.
const adapters: Record<SiteId, SiteAdapter> = {
  olx: createFakeAdapter("olx"),
  vinted: createFakeAdapter("vinted"),
  allegro: createFakeAdapter("allegro"),
};

const storage = createStorage();
const rateLimiter = new SiteRateLimiter();
const notificationTargets = new NotificationTargetStore(new ChromeLocalStore());
const notifier = new Notifier(new ChromeNotifications(), notificationTargets);

const siteFloorsMinutes: Record<SiteId, number> = Object.fromEntries(
  (Object.keys(adapters) as SiteId[]).map((site) => [
    site,
    Math.max(1, Math.ceil(adapters[site].minIntervalMs / 60_000)),
  ]),
) as Record<SiteId, number>;

const lifecycleDeps: LifecycleDeps = {
  adapters,
  offers: storage.offers,
  watches: storage.watches,
  siteHealth: storage.siteHealth,
  rateLimiter,
  notifier,
  logs: storage.logs,
  siteFloorsMinutes,
};

async function runWatchAndReschedule(watchId: string): Promise<void> {
  const watch = await storage.watches.get(watchId);
  if (!watch) {
    await clearWatchAlarm(watchId);
    return;
  }
  if (watch.paused) return; // Resuming a watch re-schedules its alarm itself.

  try {
    await checkWatch(watch, lifecycleDeps);
  } catch (err) {
    await storage.logs.append("error", "checkWatch failed", {
      watchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const base = effectiveIntervalMinutes(watch, siteFloorsMinutes);
  await scheduleWatchAlarm(watchId, jitteredDelayMinutes(base));
}

chrome.alarms.onAlarm.addListener((alarm) => {
  const watchId = parseWatchIdFromAlarm(alarm.name);
  if (!watchId) return;
  void runWatchAndReschedule(watchId);
});

async function handleMessage(request: BackgroundRequest): Promise<unknown> {
  switch (request.type) {
    case "watch/create":
      return createWatchAndRunBaseline(lifecycleDeps, request.input);
    case "watch/checkNow":
      return runCheckWatchNow(lifecycleDeps, request.watchId);
    case "watch/pause":
      return runPauseWatch(lifecycleDeps, request.watchId);
    case "watch/resume":
      return runResumeWatch(lifecycleDeps, request.watchId);
    case "watch/delete":
      return runDeleteWatch(lifecycleDeps, request.watchId);
  }
}

chrome.runtime.onMessage.addListener(
  (request: BackgroundRequest, _sender, sendResponse) => {
    handleMessage(request)
      .then((data) => sendResponse({ ok: true, data } satisfies BackgroundResponse))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies BackgroundResponse),
      );
    return true; // keep the message channel open for the async response
  },
);

chrome.notifications.onClicked.addListener((notificationId) => {
  void (async () => {
    const target = await notificationTargets.take(notificationId);
    if (!target) return;
    if (target.type === "offer") {
      await storage.offers.setState(target.offerKey, "seen");
      await chrome.tabs.create({ url: target.url });
    } else {
      try {
        await chrome.action.openPopup();
      } catch {
        // openPopup() needs a user gesture and can be refused by the
        // browser; falling back to the watch's detail page is always safe.
        await chrome.tabs.create({
          url: chrome.runtime.getURL(
            `src/ui/options/index.html#/watches/${target.watchId}`,
          ),
        });
      }
    }
    chrome.notifications.clear(notificationId);
  })();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.runtime.openOptionsPage();
  }
});
