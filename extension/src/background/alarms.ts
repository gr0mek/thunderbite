import type { SiteId } from "@/adapters/types";
import type { Watch } from "@/shared/schemas";

const ALARM_PREFIX = "watch:";
const JITTER_FRACTION = 0.2; // §6 rule 11

export function watchAlarmName(watchId: string): string {
  return `${ALARM_PREFIX}${watchId}`;
}

export function parseWatchIdFromAlarm(alarmName: string): string | null {
  return alarmName.startsWith(ALARM_PREFIX) ? alarmName.slice(ALARM_PREFIX.length) : null;
}

/**
 * The interval actually used for a watch: the user's setting, floored by
 * the slowest of its selected sites' hard minimums (§6 rule 10 — the floor
 * applies "niezależnie od ustawień użytkownika").
 */
export function effectiveIntervalMinutes(
  watch: Pick<Watch, "checkIntervalMinutes" | "sites">,
  siteMinIntervalMinutes: Record<SiteId, number>,
): number {
  const floor = Math.max(...watch.sites.map((s) => siteMinIntervalMinutes[s]));
  return Math.max(watch.checkIntervalMinutes, floor);
}

/** ±20% jitter (§6 rule 11), rounded to whole minutes and never below 1. */
export function jitteredDelayMinutes(baseMinutes: number, random = Math.random): number {
  const jitter = 1 + (random() * 2 - 1) * JITTER_FRACTION;
  return Math.max(1, Math.round(baseMinutes * jitter));
}

export async function scheduleWatchAlarm(
  watchId: string,
  delayMinutes: number,
): Promise<void> {
  await chrome.alarms.create(watchAlarmName(watchId), {
    delayInMinutes: Math.max(1, delayMinutes),
  });
}

export async function clearWatchAlarm(watchId: string): Promise<void> {
  await chrome.alarms.clear(watchAlarmName(watchId));
}
