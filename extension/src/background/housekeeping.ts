import type { SiteAdapter, SiteId } from "@/adapters/types";
import { runHealthChecks } from "@/core/healthcheck";
import type { Logger } from "@/shared/logger";
import type { OfferRepo } from "@/storage/offerRepo";
import type { SettingsRepo } from "@/storage/settingsRepo";
import type { SiteHealthRepo } from "@/storage/siteHealthRepo";
import type { ScanLogRepo } from "@/storage/scanLogRepo";

export const HOUSEKEEPING_ALARM_NAME = "housekeeping";
export const HOUSEKEEPING_PERIOD_MINUTES = 30;

export interface HousekeepingDeps {
  adapters: Record<SiteId, SiteAdapter>;
  siteHealth: SiteHealthRepo;
  offers: OfferRepo;
  settings: SettingsRepo;
  logger: Logger;
  scans?: ScanLogRepo | undefined;
}

/** Runs on a fixed recurring alarm, independent of any watch's own
 * schedule: per-site smoke tests (§7) and offer retention cleanup (§3.2). */
export async function runHousekeeping(deps: HousekeepingDeps): Promise<void> {
  await runHealthChecks({
    adapters: deps.adapters,
    siteHealth: deps.siteHealth,
    logger: deps.logger,
    scans: deps.scans,
    logOnlyFailures: true,
  });

  const { offerRetentionDays } = await deps.settings.get();
  const deleted = await deps.offers.deleteOlderThan(offerRetentionDays);
  if (deleted > 0) {
    deps.logger.info(
      `Purged ${deleted} offer(s) past the ${offerRetentionDays}-day retention window`,
    );
  }
}
