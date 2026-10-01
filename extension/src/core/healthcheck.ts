import type { SiteAdapter, SiteId } from "@/adapters/types";
import type { Logger } from "@/shared/logger";
import type { RequestTrace, ScanErrorCode, ScanRecord } from "@/shared/schemas";
import { toScanError } from "@/shared/scanErrors";
import type { ScanLogRepo } from "@/storage/scanLogRepo";
import type { SiteHealthRepo } from "@/storage/siteHealthRepo";

const SITES: SiteId[] = ["vinted"];

export interface HealthCheckDeps {
  adapters: Record<SiteId, SiteAdapter>;
  siteHealth: SiteHealthRepo;
  logger: Logger;
  scans?: ScanLogRepo | undefined;
  /** Periodic checks only log failures, so they don't push real watch
   * scans out of the (size-capped) scan log. */
  logOnlyFailures?: boolean;
}

/**
 * startSmartBuy.md §7: each adapter runs a periodic smoke test independent
 * of whatever the user's watches happen to query, so a site with no active
 * watches still gets a status. Smoke-test results feed the same
 * consecutive-error counter as real search failures (SiteHealthRepo) — one
 * combined signal for "is this site working," not two competing ones.
 *
 * Also used for the diagnostics screen's "Test połączenia"; returns one
 * scan record per site.
 */
export async function runHealthChecks(deps: HealthCheckDeps): Promise<ScanRecord[]> {
  const records: ScanRecord[] = [];
  for (const site of SITES) {
    const startedAt = new Date().toISOString();
    const started = Date.now();
    const requests: RequestTrace[] = [];
    let error: { code: ScanErrorCode; message: string } | undefined;
    try {
      const result = await deps.adapters[site].healthCheck((r) => requests.push(r));
      if (result === "ok") {
        await deps.siteHealth.recordSuccess(site);
      } else {
        // The failing request's own code, if any, says more than "broken".
        const failed = [...requests].reverse().find((r) => r.code);
        error =
          result === "degraded"
            ? { code: "VNT-EMPTY", message: "Health check returned no usable items" }
            : {
                code: failed?.code ?? "APP-UNKNOWN",
                message: failed
                  ? `Health check failed: ${failed.status === null ? "no response" : `HTTP ${failed.status}`} (${failed.via})${failed.note ? ` — ${failed.note}` : ""}`
                  : `Health check reported ${result}`,
              };
        await deps.siteHealth.recordError(site, error);
        deps.logger.warn(`Health check reported ${result} for ${site} [${error.code}]`);
      }
    } catch (err) {
      const e = toScanError(err);
      error = { code: e.code, message: e.message };
      await deps.siteHealth.recordError(site, error);
      deps.logger.error(`Health check threw for ${site} [${e.code}]`, {
        error: e.message,
      });
    }
    const record: ScanRecord = {
      id: crypto.randomUUID(),
      kind: "health",
      site,
      startedAt,
      durationMs: Date.now() - started,
      ok: !error,
      baseline: false,
      fetched: requests.reduce((n, r) => n + (r.items ?? 0), 0),
      matched: 0,
      inserted: 0,
      errorCode: error?.code,
      errorMessage: error?.message.slice(0, 500),
      requests,
    };
    const log = deps.scans && !(deps.logOnlyFailures && record.ok);
    records.push(log ? await deps.scans!.append(record) : record);
  }
  return records;
}
