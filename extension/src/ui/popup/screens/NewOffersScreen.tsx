import { Fragment } from "preact";
import { useMemo } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { formatDayLabel, formatRelativeTime } from "@/shared/format";
import type { SearchContext } from "@/adapters/searchContext";
import type { SiteId } from "@/adapters/types";
import type { OfferRecord, Watch } from "@/shared/schemas";
import { checkWatchNow as sendCheckWatchNow } from "@/background/messages";
import { storage, useAllOffers } from "@/ui/shared/dataHooks";
import { EmptyState } from "@/ui/shared/EmptyState";
import { OfferRow } from "../components/OfferRow";
import { QuickAddBanner } from "../components/QuickAddBanner";
import { Skeleton } from "../components/Skeleton";

interface NewOffersScreenProps {
  watches: Watch[];
  onAddWatch: () => void;
  quickAdd?: { site: SiteId; context: SearchContext } | null;
  onQuickAdd?: () => void;
}

interface Row {
  offer: OfferRecord;
  watchName: string;
}

export function NewOffersScreen({
  watches,
  onAddWatch,
  quickAdd,
  onQuickAdd,
}: NewOffersScreenProps) {
  const { offersByWatch, reload } = useAllOffers(watches, "new");
  const watchById = useMemo(() => new Map(watches.map((w) => [w.id, w])), [watches]);

  const { deals, suspicious, fresh, baseline } = useMemo(() => {
    const rows: Row[] = [];
    for (const [watchId, offers] of offersByWatch) {
      const watch = watchById.get(watchId);
      if (!watch) continue;
      for (const offer of offers) rows.push({ offer, watchName: watch.name });
    }
    rows.sort((a, b) => b.offer.foundAt.localeCompare(a.offer.foundAt));
    // Deal-mode offers get their own sections at the top: deals first (the
    // reason the user is here), then the suspiciously cheap ones to check.
    const isDealRow = (r: Row) => !r.offer.isBaseline && !!r.offer.dealKind;
    return {
      deals: rows.filter((r) => isDealRow(r) && r.offer.dealKind === "deal"),
      suspicious: rows.filter((r) => isDealRow(r) && r.offer.dealKind === "suspicious"),
      fresh: rows.filter((r) => !r.offer.isBaseline && !r.offer.dealKind),
      baseline: rows.filter((r) => r.offer.isBaseline),
    };
  }, [offersByWatch, watchById]);

  const waitingForFirstCheck =
    watches.length > 0 && watches.every((w) => !w.baselineCompletedAt);

  async function openOffer(row: Row) {
    await storage.offers.setState(row.offer.key, "seen");
    await chrome.tabs.create({ url: row.offer.url });
    reload();
  }

  async function hideOffer(row: Row) {
    await storage.offers.setState(row.offer.key, "hidden");
    reload();
  }

  async function markAllSeen() {
    await Promise.all(watches.map((w) => storage.offers.markAllSeenForWatch(w.id)));
    reload();
  }

  if (watches.length === 0) {
    return (
      <EmptyState
        message={copy.emptyStates.noWatches}
        action={
          <button type="button" class="btn btn-primary" onClick={onAddWatch}>
            {copy.emptyStates.addFirstWatch}
          </button>
        }
      />
    );
  }

  if (waitingForFirstCheck) {
    return (
      <div class="col gap3" style={{ padding: 16 }}>
        <div class="text-meta" style={{ fontWeight: 600, color: "var(--ink-muted)" }}>
          {copy.emptyStates.firstCheckInProgress}
        </div>
        <div class="text-body" style={{ color: "var(--ink-muted)" }}>
          {copy.emptyStates.checkingSites}
        </div>
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (
    deals.length === 0 &&
    suspicious.length === 0 &&
    fresh.length === 0 &&
    baseline.length === 0
  ) {
    const mostRecentCheck = watches
      .map((w) => w.lastCheckedAt)
      .filter((t): t is string => !!t)
      .sort()
      .at(-1);
    return (
      <EmptyState
        message={copy.emptyStates.noNewOffers(
          mostRecentCheck ? formatRelativeTime(mostRecentCheck) : "—",
        )}
        action={
          <button
            type="button"
            class="banner-action"
            onClick={() => void sendCheckWatchNow(watches[0]!.id)}
          >
            {copy.emptyStates.seeEarlierOffers}
          </button>
        }
      />
    );
  }

  let lastDay = "";
  return (
    <div class="col f1" style={{ minHeight: 0 }}>
      <div class="col popup-scroll">
        {quickAdd && onQuickAdd && (
          <QuickAddBanner
            site={quickAdd.site}
            context={quickAdd.context}
            onAdd={onQuickAdd}
          />
        )}
        {deals.length > 0 && <div class="popup-day-header">{copy.deal.sectionDeals}</div>}
        {deals.map((row) => (
          <OfferRow
            key={row.offer.key}
            offer={row.offer}
            watchName={row.watchName}
            onOpen={() => void openOffer(row)}
            onHide={() => void hideOffer(row)}
          />
        ))}
        {suspicious.length > 0 && (
          <div class="popup-day-header">{copy.deal.sectionSuspicious}</div>
        )}
        {suspicious.map((row) => (
          <OfferRow
            key={row.offer.key}
            offer={row.offer}
            watchName={row.watchName}
            onOpen={() => void openOffer(row)}
            onHide={() => void hideOffer(row)}
          />
        ))}
        {fresh.map((row) => {
          const day = formatDayLabel(row.offer.foundAt);
          const showHeader = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={row.offer.key}>
              {showHeader && <div class="popup-day-header">{day}</div>}
              <OfferRow
                offer={row.offer}
                watchName={row.watchName}
                onOpen={() => void openOffer(row)}
                onHide={() => void hideOffer(row)}
              />
            </Fragment>
          );
        })}
        {baseline.length > 0 && (
          <>
            <div class="popup-day-header">
              {copy.watchDetail.alreadyAvailable(baseline.length)}
            </div>
            {baseline.map((row) => (
              <OfferRow
                key={row.offer.key}
                offer={row.offer}
                watchName={row.watchName}
                onOpen={() => void openOffer(row)}
                onHide={() => void hideOffer(row)}
              />
            ))}
          </>
        )}
      </div>
      <div class="popup-footer">
        <button
          type="button"
          class="text-meta"
          style={{ background: "none", border: "none", cursor: "pointer" }}
          onClick={() => void markAllSeen()}
        >
          {copy.popupFooter.markAllSeen}
        </button>
        <button type="button" class="btn btn-primary" onClick={onAddWatch}>
          {copy.popupFooter.addWatch}
        </button>
      </div>
    </div>
  );
}
