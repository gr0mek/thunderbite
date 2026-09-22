import { copy } from "./copy.pl";

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
