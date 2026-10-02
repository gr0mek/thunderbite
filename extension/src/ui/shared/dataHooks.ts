import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { createStorage } from "@/storage";
import type { OfferFilter } from "@/storage/offerRepo";
import type {
  LogEntry,
  OfferRecord,
  PricePoint,
  ScanRecord,
  SiteHealth,
  Watch,
} from "@/shared/schemas";

// One instance per extension page (popup/options each have their own JS
// context) — all backed by the same chrome.storage.local/IndexedDB, so
// they stay consistent with each other and with the background page.
export const storage = createStorage();

/** Popups are short-lived and IndexedDB writes from the background don't
 * fire chrome.storage.onChanged, so screens that need to reflect
 * in-progress background work (a check running while the popup is open)
 * poll at a light interval instead of building a full pub/sub layer. */
function usePolling(intervalMs: number, callback: () => void): void {
  useEffect(() => {
    const id = setInterval(callback, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, callback]);
}

export function useWatches(pollMs = 3000): { watches: Watch[]; reload: () => void } {
  const [watches, setWatches] = useState<Watch[]>([]);
  const reload = useCallback(() => {
    void storage.watches.list().then(setWatches);
  }, []);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return { watches, reload };
}

export function useWatch(
  watchId: string | undefined,
  pollMs = 3000,
): { watch: Watch | undefined; reload: () => void } {
  const [watch, setWatch] = useState<Watch | undefined>(undefined);
  const reload = useCallback(() => {
    if (!watchId) return;
    void storage.watches.get(watchId).then(setWatch);
  }, [watchId]);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return { watch, reload };
}

export function useOffersByWatch(
  watchId: string | undefined,
  filter: OfferFilter = "all",
  pollMs = 3000,
): { offers: OfferRecord[]; reload: () => void } {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const reload = useCallback(() => {
    if (!watchId) return;
    void storage.offers.listByWatch(watchId, filter).then(setOffers);
  }, [watchId, filter]);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return { offers, reload };
}

export function useAllOffers(
  watches: Watch[],
  filter: OfferFilter = "all",
  pollMs = 3000,
): { offersByWatch: Map<string, OfferRecord[]>; reload: () => void } {
  const [offersByWatch, setOffersByWatch] = useState<Map<string, OfferRecord[]>>(
    new Map(),
  );
  // A ref keeps `reload`'s identity tied to the set of watch ids (below),
  // not to `watches`' array reference, which changes on every poll tick.
  const watchesRef = useRef(watches);
  watchesRef.current = watches;
  const watchIds = watches.map((w) => w.id).join(",");
  const reload = useCallback(() => {
    void Promise.all(
      watchesRef.current.map(
        async (w) => [w.id, await storage.offers.listByWatch(w.id, filter)] as const,
      ),
    ).then((entries) => setOffersByWatch(new Map(entries)));
  }, [watchIds, filter]);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return { offersByWatch, reload };
}

export function useSiteHealth(pollMs = 5000): SiteHealth[] {
  const [health, setHealth] = useState<SiteHealth[]>([]);
  const reload = useCallback(() => {
    void storage.siteHealth.list().then(setHealth);
  }, []);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return health;
}

/** Diagnostics scan log, newest first. */
export function useScanLog(pollMs = 3000): { scans: ScanRecord[]; reload: () => void } {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const reload = useCallback(() => {
    void storage.scans.list().then(setScans);
  }, []);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return { scans, reload };
}

/** Technical log (Logger ring buffer), newest first. */
export function useLogEntries(pollMs = 5000): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const reload = useCallback(() => {
    void storage.logs.list().then((l) => setLogs([...l].reverse()));
  }, []);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return logs;
}

/** Deal mode's price history for one watch (last `days` days). */
export function usePriceHistory(
  watchId: string | undefined,
  days: number,
  pollMs = 10000,
): PricePoint[] {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const reload = useCallback(() => {
    if (!watchId) return;
    void storage.prices.listByWatch(watchId, days).then(setPoints);
  }, [watchId, days]);
  useEffect(reload, [reload]);
  usePolling(pollMs, reload);
  return points;
}
