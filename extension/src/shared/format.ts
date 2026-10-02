import { copy } from "./copy.pl";
import type { SiteId } from "@/adapters/types";
import type { OfferRecord } from "./schemas";

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

/** "4 200 zł" for PLN (the default), "$1,250" / "$12.99" for USD. */
export function formatPrice(price: number | null, currency = "PLN"): string {
  return price === null ? "—" : copy.price.format(price, currency);
}

/** Time until an auction ends: "za 45 min", "za 3 h", "za 2 dni"; null
 * once it's over. */
export function formatTimeLeft(iso: string, now = Date.now()): string | null {
  const left = new Date(iso).getTime() - now;
  if (!(left > 0)) return null;
  if (left < HOUR) return copy.timeLeft.minutes(Math.max(1, Math.ceil(left / MINUTE)));
  if (left < DAY) return copy.timeLeft.hours(Math.floor(left / HOUR));
  return copy.timeLeft.days(Math.floor(left / DAY));
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

/** "+ $18.50 wysyłka" / "darmowa wysyłka"; null when the site didn't say. */
export function formatShipping(
  offer: Pick<OfferRecord, "shippingCost" | "currency">,
): string | null {
  if (offer.shippingCost === undefined) return null;
  return offer.shippingCost === 0
    ? copy.offerRow.freeShipping
    : copy.offerRow.shipping(formatPrice(offer.shippingCost, offer.currency));
}

/** "3 oferty · koniec za 2 h" for an auction; null otherwise. */
export function formatAuctionMeta(
  offer: Pick<OfferRecord, "auction">,
  now = Date.now(),
): string | null {
  if (!offer.auction) return null;
  const { bidCount, endsAt } = offer.auction;
  const left = endsAt ? formatTimeLeft(endsAt, now) : null;
  return [
    bidCount !== undefined ? copy.offerRow.auctionBids(bidCount) : null,
    endsAt
      ? left
        ? copy.offerRow.auctionEndsIn(left)
        : copy.offerRow.auctionEnded
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
