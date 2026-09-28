import { copy } from "./copy.pl";
import type { SiteId } from "@/adapters/types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * uxSmartBuy.md §7: relative time up to 24h ("12 min temu"), then an
 * absolute Polish date ("21 wrz").
 */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  if (diffMs < MINUTE) return copy.relativeTime.justNow;
  if (diffMs < HOUR) return copy.relativeTime.minutesAgo(Math.floor(diffMs / MINUTE));
  if (diffMs < DAY) return copy.relativeTime.hoursAgo(Math.floor(diffMs / HOUR));
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(
    then,
  );
}

export function formatPrice(price: number | null): string {
  return price === null ? "—" : copy.price.format(price);
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Day-group header for offer lists (uxSmartBuy.md §5.1: "Dziś" / "Wczoraj"
 * / an absolute date) — distinct from formatRelativeTime, which labels an
 * individual row. */
export function formatDayLabel(iso: string, now = Date.now()): string {
  const day = startOfDay(new Date(iso).getTime());
  const today = startOfDay(now);
  if (day === today) return "Dziś";
  if (today - day === 24 * 60 * 60 * 1000) return "Wczoraj";
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(day);
}

/** "Vinted" — the watch-detail filter sentence's site list (uxSmartBuy.md
 * §5.4). Still joins an array for when a second site is added back. */
export function formatSiteList(sites: SiteId[]): string {
  const names = sites.map((s) => copy.siteNames[s]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} i ${names.at(-1)}`;
}
