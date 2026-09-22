import type { SiteId } from "@/adapters/types";

const SITES: SiteId[] = ["olx", "vinted", "allegro"];
const JITTER_FRACTION = 0.2; // ±20%, startSmartBuy.md §6 rule 11

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withJitter(ms: number): number {
  const jitter = 1 + (Math.random() * 2 - 1) * JITTER_FRACTION;
  return Math.round(ms * jitter);
}

/**
 * Serializes requests to each marketplace and enforces its minIntervalMs
 * floor, independent of anything the user configured — startSmartBuy.md §6
 * rules 10-11 ("MUST respektować minIntervalMs ... MUST NOT wykonywać
 * równolegle w dużej liczbie"). One instance per service-worker lifetime:
 * an in-memory promise chain per site is enough to prevent bursts within a
 * wake-up, which is what the rule is actually guarding against.
 */
export class SiteRateLimiter {
  private queue: Record<SiteId, Promise<unknown>> = Object.fromEntries(
    SITES.map((s) => [s, Promise.resolve()]),
  ) as Record<SiteId, Promise<unknown>>;
  private nextAvailableAt: Record<SiteId, number> = Object.fromEntries(
    SITES.map((s) => [s, 0]),
  ) as Record<SiteId, number>;

  async run<T>(site: SiteId, minIntervalMs: number, fn: () => Promise<T>): Promise<T> {
    const task = async (): Promise<T> => {
      const wait = Math.max(0, this.nextAvailableAt[site] - Date.now());
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        this.nextAvailableAt[site] = Date.now() + withJitter(minIntervalMs);
      }
    };
    // Chain onto the previous task for this site regardless of whether it
    // succeeded, so one failure doesn't wedge the queue, but always return
    // *this* call's own result/rejection to the caller.
    const chained = this.queue[site].catch(() => undefined).then(task);
    this.queue[site] = chained.catch(() => undefined);
    return chained;
  }
}
