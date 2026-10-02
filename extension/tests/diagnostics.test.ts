import { describe, expect, it } from "vitest";
import { createUnconfiguredAdapter } from "@/adapters/fake";
import type { NormalizedOffer, SiteAdapter } from "@/adapters/types";
import { checkWatch } from "@/core/checkWatch";
import { runHealthChecks } from "@/core/healthcheck";
import { buildDiagnosticsReport } from "@/core/diagnosticsReport";
import { Logger } from "@/shared/logger";
import { ScanError, toScanError } from "@/shared/scanErrors";
import { MAX_SCAN_RECORDS, ScanLogRepo } from "@/storage/scanLogRepo";
import { LogRepo } from "@/storage/logRepo";
import { MemoryStore } from "@/storage/local";
import { RootStore } from "@/storage/rootStore";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";
import { WatchRepo } from "@/storage/watchRepo";
import { OfferRepo } from "@/storage/offerRepo";
import { openOfferDb } from "@/storage/offerDb";
import { SiteRateLimiter } from "@/background/rateLimiter";
import type { Notifier } from "@/background/notifier";
import type { ScanRecord } from "@/shared/schemas";

function setup() {
  const root = new RootStore(new MemoryStore());
  return {
    root,
    scans: new ScanLogRepo(root),
    siteHealth: new SiteHealthRepo(root),
    watches: new WatchRepo(root),
    logger: new Logger(new LogRepo(root)),
  };
}

const offer: NormalizedOffer = {
  site: "vinted",
  externalId: "1",
  url: "https://www.vinted.pl/items/1",
  title: "Kurtka nike",
  price: 50,
  currency: "PLN",
};

function adapter(
  search: SiteAdapter["search"],
  healthCheck: SiteAdapter["healthCheck"] = async () => "ok",
): SiteAdapter {
  return { id: "vinted", minIntervalMs: 0, search, healthCheck };
}

describe("toScanError", () => {
  it("keeps coded errors and classifies the rest", () => {
    const coded = new ScanError("VNT-403", "blocked");
    expect(toScanError(coded)).toBe(coded);
    expect(toScanError(new DOMException("t", "TimeoutError")).code).toBe("VNT-TIMEOUT");
    expect(toScanError(new Error("boom"))).toMatchObject({
      code: "APP-UNKNOWN",
      message: "boom",
    });
  });
});

describe("ScanLogRepo", () => {
  it("returns newest first and caps the buffer", async () => {
    const { scans } = setup();
    for (let i = 0; i < MAX_SCAN_RECORDS + 5; i++) {
      await scans.append({
        id: String(i),
        kind: "health",
        site: "vinted",
        startedAt: new Date().toISOString(),
        durationMs: 1,
        ok: true,
        baseline: false,
        fetched: 0,
        matched: 0,
        inserted: 0,
        requests: [],
      });
    }
    const list = await scans.list();
    expect(list).toHaveLength(MAX_SCAN_RECORDS);
    expect(list[0]?.id).toBe(String(MAX_SCAN_RECORDS + 4));
    await scans.clear();
    expect(await scans.list()).toEqual([]);
  });
});

describe("checkWatch scan log", () => {
  async function run(search: SiteAdapter["search"]) {
    const s = setup();
    const watch = await s.watches.create({ name: "Kurtka", keywords: ["nike"] });
    await checkWatch(watch, {
      adapters: { vinted: adapter(search), ebay: createUnconfiguredAdapter("ebay") },
      offers: new OfferRepo(openOfferDb(`diag-${crypto.randomUUID()}`)),
      watches: s.watches,
      siteHealth: s.siteHealth,
      rateLimiter: new SiteRateLimiter(),
      notifier: { notifyNewOffers: async () => undefined } as unknown as Notifier,
      logger: s.logger,
      scans: s.scans,
    });
    return { ...s, watch };
  }

  it("records a successful scan with counts and request traces", async () => {
    const { scans, watch } = await run(async (_q, _s, onRequest) => {
      onRequest?.({ url: "u", via: "sw", attempt: 1, status: 200, ms: 5, items: 1 });
      return [offer];
    });
    const [record] = await scans.list();
    expect(record).toMatchObject({
      kind: "watch",
      watchId: watch.id,
      watchName: "Kurtka",
      ok: true,
      baseline: true,
      fetched: 1,
      matched: 1,
      inserted: 1,
    });
    expect(record?.requests).toHaveLength(1);
  });

  it("records the error code on the scan and on site health", async () => {
    const { scans, siteHealth } = await run(async () => {
      throw new ScanError("VNT-403", "Vinted responded 403");
    });
    const [record] = await scans.list();
    expect(record).toMatchObject({ ok: false, errorCode: "VNT-403" });
    expect(await siteHealth.get("vinted")).toMatchObject({
      status: "degraded",
      lastErrorCode: "VNT-403",
      lastErrorMessage: "Vinted responded 403",
    });
  });
});

describe("runHealthChecks scan log", () => {
  it("uses the failing request's code", async () => {
    const s = setup();
    const [record] = await runHealthChecks({
      adapters: {
        vinted: adapter(
          async () => [],
          async (onRequest) => {
            onRequest?.({
              url: "u",
              via: "sw",
              attempt: 1,
              status: 403,
              ms: 1,
              code: "VNT-403",
            });
            return "broken";
          },
        ),
        ebay: createUnconfiguredAdapter("ebay"),
      },
      siteHealth: s.siteHealth,
      logger: s.logger,
      scans: s.scans,
    });
    expect(record).toMatchObject({ kind: "health", ok: false, errorCode: "VNT-403" });
    expect(await s.scans.list()).toHaveLength(1);
  });

  it("skips logging successful periodic checks when asked", async () => {
    const s = setup();
    await runHealthChecks({
      adapters: {
        vinted: adapter(async () => []),
        ebay: createUnconfiguredAdapter("ebay"),
      },
      siteHealth: s.siteHealth,
      logger: s.logger,
      scans: s.scans,
      logOnlyFailures: true,
    });
    expect(await s.scans.list()).toEqual([]);
  });
});

describe("buildDiagnosticsReport", () => {
  it("includes recent scans and only warn/error logs", () => {
    const scan = { id: "a", ok: false, errorCode: "VNT-403" } as ScanRecord;
    const report = JSON.parse(
      buildDiagnosticsReport({
        environment: null,
        health: [],
        scans: [scan],
        logs: [
          { level: "info", message: "x", at: new Date().toISOString() },
          { level: "error", message: "y", at: new Date().toISOString() },
        ],
        generatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    expect(report.scans).toEqual([scan]);
    expect(report.logs.map((l: { message: string }) => l.message)).toEqual(["y"]);
  });
});
