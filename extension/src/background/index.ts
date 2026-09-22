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
  updateWatchAndReschedule,
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
import {
  HOUSEKEEPING_ALARM_NAME,
  HOUSEKEEPING_PERIOD_MINUTES,
  runHousekeeping,
} from "./housekeeping";
import { ChromeLocalStore } from "@/storage/local";
import { createStorage } from "@/storage";
import { Logger } from "@/shared/logger";
import type { SearchContext } from "@/adapters/searchContext";

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
const logger = new Logger(storage.logs);

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
  logger,
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
    logger.error("checkWatch failed", {
      watchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const base = effectiveIntervalMinutes(watch, siteFloorsMinutes);
  await scheduleWatchAlarm(watchId, jitteredDelayMinutes(base));
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HOUSEKEEPING_ALARM_NAME) {
    void runHousekeeping({
      adapters,
      siteHealth: storage.siteHealth,
      offers: storage.offers,
      settings: storage.settings,
      logger,
    });
    return;
  }
  const watchId = parseWatchIdFromAlarm(alarm.name);
  if (!watchId) return;
  void runWatchAndReschedule(watchId);
});

// Idempotent: re-creating an alarm with the same name replaces it, so this
// is safe to run on every service-worker wake-up rather than gating it on
// onInstalled/onStartup.
void chrome.alarms.create(HOUSEKEEPING_ALARM_NAME, {
  periodInMinutes: HOUSEKEEPING_PERIOD_MINUTES,
});

// F3 quick-add (uxSmartBuy.md §4 F3): content scripts report what they see
// on a marketplace search page, keyed by tab id, so the popup can show a
// banner if it's opened while that tab is active. Detection itself is
// stubbed out for now (adapters/searchContext.ts), so this map stays
// empty in practice — the relay is real and ready regardless. In-memory
// only: losing it on a service-worker restart just means the banner
// doesn't show until the content script re-reports, which is harmless.
const quickAddByTab = new Map<number, { site: SiteId; context: SearchContext }>();

chrome.tabs.onRemoved.addListener((tabId) => quickAddByTab.delete(tabId));

async function handleMessage(
  request: BackgroundRequest,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  switch (request.type) {
    case "watch/create":
      return createWatchAndRunBaseline(lifecycleDeps, request.input);
    case "watch/update":
      return updateWatchAndReschedule(lifecycleDeps, request.watchId, request.patch);
    case "watch/checkNow":
      return runCheckWatchNow(lifecycleDeps, request.watchId);
    case "watch/pause":
      return runPauseWatch(lifecycleDeps, request.watchId);
    case "watch/resume":
      return runResumeWatch(lifecycleDeps, request.watchId);
    case "watch/delete":
      return runDeleteWatch(lifecycleDeps, request.watchId);
    case "quickAdd/detected":
      if (sender.tab?.id !== undefined) {
        quickAddByTab.set(sender.tab.id, {
          site: request.site,
          context: request.context,
        });
      }
      return undefined;
    case "quickAdd/get":
      return quickAddByTab.get(request.tabId) ?? null;
  }
}

chrome.runtime.onMessage.addListener(
  (request: BackgroundRequest, sender, sendResponse) => {
    handleMessage(request, sender)
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
