import { describe, expect, it } from "vitest";
import {
  effectiveIntervalMinutes,
  jitteredDelayMinutes,
  parseWatchIdFromAlarm,
  watchAlarmName,
} from "@/background/alarms";
import { SiteRateLimiter } from "@/background/rateLimiter";

describe("alarm naming", () => {
  it("round-trips a watch id through the alarm name", () => {
    const name = watchAlarmName("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
    expect(parseWatchIdFromAlarm(name)).toBe("9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d");
  });

  it("returns null for an alarm name that isn't ours", () => {
    expect(parseWatchIdFromAlarm("some-other-alarm")).toBeNull();
  });
});

describe("effectiveIntervalMinutes", () => {
  const floors = { olx: 5, vinted: 5, allegro: 5 };

  it("uses the user's interval when it's already above every selected site's floor", () => {
    expect(
      effectiveIntervalMinutes({ checkIntervalMinutes: 60, sites: ["olx"] }, floors),
    ).toBe(60);
  });

  it("floors a too-low interval to the slowest selected site's minimum (§6 rule 10)", () => {
    expect(
      effectiveIntervalMinutes(
        { checkIntervalMinutes: 5, sites: ["olx", "vinted"] },
        { olx: 5, vinted: 20, allegro: 5 },
      ),
    ).toBe(20);
  });
});

describe("jitteredDelayMinutes", () => {
  it("stays within ±20% and never drops below 1", () => {
    for (const r of [0, 0.25, 0.5, 0.75, 1]) {
      const delay = jitteredDelayMinutes(15, () => r);
      expect(delay).toBeGreaterThanOrEqual(12);
      expect(delay).toBeLessThanOrEqual(18);
    }
    expect(jitteredDelayMinutes(1, () => 0)).toBeGreaterThanOrEqual(1);
  });
});

describe("SiteRateLimiter", () => {
  it("serializes calls to the same site with at least minIntervalMs between them", async () => {
    const limiter = new SiteRateLimiter();
    const starts: number[] = [];
    const t0 = Date.now();
    await Promise.all([
      limiter.run("olx", 40, async () => {
        starts.push(Date.now() - t0);
      }),
      limiter.run("olx", 40, async () => {
        starts.push(Date.now() - t0);
      }),
    ]);
    expect(starts).toHaveLength(2);
    // Second call must not start before the first's floor elapses (allow
    // jitter's -20% and a little scheduling slack).
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(28);
  });

  it("does not make different sites wait on each other", async () => {
    const limiter = new SiteRateLimiter();
    const t0 = Date.now();
    let vintedStart = 0;
    await Promise.all([
      limiter.run("olx", 200, () => new Promise((r) => setTimeout(r, 200))),
      limiter.run("vinted", 200, async () => {
        vintedStart = Date.now() - t0;
      }),
    ]);
    expect(vintedStart).toBeLessThan(100);
  });

  it("keeps the queue usable after a failed call", async () => {
    const limiter = new SiteRateLimiter();
    await expect(
      limiter.run("allegro", 1, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(limiter.run("allegro", 1, async () => "ok")).resolves.toBe("ok");
  });
});
