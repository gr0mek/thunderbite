import type { SiteId } from "@/adapters/types";
import type { Watch } from "@/shared/schemas";
import {
  clearWatchAlarm,
  effectiveIntervalMinutes,
  jitteredDelayMinutes,
  scheduleWatchAlarm,
} from "@/background/alarms";
import type { CheckWatchDeps } from "./checkWatch";
import { checkWatch } from "./checkWatch";

export interface LifecycleDeps extends CheckWatchDeps {
  siteFloorsMinutes: Record<SiteId, number>;
}

async function scheduleNext(deps: LifecycleDeps, watch: Watch): Promise<void> {
  const minutes = effectiveIntervalMinutes(watch, deps.siteFloorsMinutes);
  await scheduleWatchAlarm(watch.id, jitteredDelayMinutes(minutes));
}

/**
 * uxSmartBuy.md §4 F2: creating a watch runs its first check immediately
 * (not after the interval) as a silent baseline — checkWatch() itself
 * handles the no-notify part via `!baselineCompletedAt`. Only once that's
 * done do we schedule the recurring alarm.
 */
export async function createWatchAndRunBaseline(
  deps: LifecycleDeps,
  input: unknown,
): Promise<Watch> {
  const created = await deps.watches.create(input);
  await checkWatch(created, deps);
  const settled = (await deps.watches.get(created.id)) ?? created;
  await scheduleNext(deps, settled);
  return settled;
}

/** "Sprawdź teraz" — §5.2 watch menu. Runs a check outside the alarm cycle,
 * then re-schedules the next regular alarm from now. */
export async function checkWatchNow(deps: LifecycleDeps, watchId: string): Promise<void> {
  const watch = await deps.watches.get(watchId);
  if (!watch) throw new Error(`Watch not found: ${watchId}`);
  await clearWatchAlarm(watchId);
  await checkWatch(watch, deps);
  const settled = (await deps.watches.get(watchId)) ?? watch;
  await scheduleNext(deps, settled);
}

export async function pauseWatch(deps: LifecycleDeps, watchId: string): Promise<Watch> {
  const watch = await deps.watches.setPaused(watchId, true);
  await clearWatchAlarm(watchId);
  return watch;
}

export async function resumeWatch(deps: LifecycleDeps, watchId: string): Promise<Watch> {
  const watch = await deps.watches.setPaused(watchId, false);
  await scheduleNext(deps, watch);
  return watch;
}

/** "Zapisz zmiany" (§5.3 edit form). Always reschedules — cheap, and
 * correct whether or not the interval/sites actually changed. Does not
 * re-run the baseline check: only creation does that. */
export async function updateWatchAndReschedule(
  deps: LifecycleDeps,
  watchId: string,
  patch: Partial<Omit<Watch, "id" | "createdAt">>,
): Promise<Watch> {
  const before = await deps.watches.get(watchId);
  let watch = await deps.watches.update(watchId, patch);
  if (before && needsMarketRelearn(before, watch)) {
    // Deal mode just switched on, or what counts as "the item" changed: the
    // old price history no longer describes it. Forget it and re-run the
    // silent baseline, which re-seeds the history with a full page.
    await deps.prices?.deleteByWatch(watchId);
    watch = await deps.watches.update(watchId, {
      market: undefined,
      baselineCompletedAt: undefined,
    });
    if (!watch.paused) {
      await checkWatch(watch, deps);
      watch = (await deps.watches.get(watchId)) ?? watch;
    }
  }
  if (watch.paused) {
    await clearWatchAlarm(watchId);
  } else {
    await scheduleNext(deps, watch);
  }
  return watch;
}

function needsMarketRelearn(before: Watch, after: Watch): boolean {
  if (!after.deal?.enabled) return false;
  if (!before.deal?.enabled) return true;
  const same = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);
  return (
    !same(before.keywords, after.keywords) ||
    !same(before.excludeKeywords, after.excludeKeywords)
  );
}

export async function deleteWatch(deps: LifecycleDeps, watchId: string): Promise<void> {
  await clearWatchAlarm(watchId);
  await deps.offers.deleteByWatch(watchId);
  await deps.prices?.deleteByWatch(watchId);
  await deps.watches.remove(watchId);
}
