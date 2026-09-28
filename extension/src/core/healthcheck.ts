import type { SiteAdapter, SiteId } from "@/adapters/types";
import type { Logger } from "@/shared/logger";
import type { SiteHealthRepo } from "@/storage/siteHealthRepo";

const SITES: SiteId[] = ["vinted"];

export interface HealthCheckDeps {
  adapters: Record<SiteId, SiteAdapter>;
  siteHealth: SiteHealthRepo;
  logger: Logger;
}

/**
 * startSmartBuy.md §7: each adapter runs a periodic smoke test independent
 * of whatever the user's watches happen to query, so a site with no active
 * watches still gets a status. Smoke-test results feed the same
 * consecutive-error counter as real search failures (SiteHealthRepo) — one
 * combined signal for "is this site working," not two competing ones.
 */
export async function runHealthChecks(deps: HealthCheckDeps): Promise<void> {
  for (const site of SITES) {
    try {
      const result = await deps.adapters[site].healthCheck();
      if (result === "ok") {
        await deps.siteHealth.recordSuccess(site);
      } else {
        await deps.siteHealth.recordError(site);
        deps.logger.warn(`Health check reported ${result} for ${site}`);
      }
    } catch (err) {
      await deps.siteHealth.recordError(site);
      deps.logger.error(`Health check threw for ${site}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
