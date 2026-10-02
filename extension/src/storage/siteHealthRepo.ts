import { SiteHealthSchema, type ScanErrorCode, type SiteHealth } from "@/shared/schemas";
import type { SiteId } from "@/adapters/types";
import { ALL_SITES } from "@/shared/sites";
import type { RootStore } from "./rootStore";

export class SiteHealthRepo {
  constructor(private readonly root: RootStore) {}

  async list(): Promise<SiteHealth[]> {
    const state = await this.root.read();
    const bySite = new Map(state.siteHealth.map((h) => [h.site, h]));
    // Always return every tracked site, even before any check has run.
    return ALL_SITES.map((site) => bySite.get(site) ?? SiteHealthSchema.parse({ site }));
  }

  async get(site: SiteId): Promise<SiteHealth> {
    return (await this.list()).find((h) => h.site === site) as SiteHealth;
  }

  /** Keeps the last error's code/message so the diagnostics screen can
   * still show what went wrong after the site recovered. */
  async recordSuccess(site: SiteId): Promise<SiteHealth> {
    const current = await this.get(site);
    return this.set(site, {
      site,
      lastErrorCode: current.lastErrorCode,
      lastErrorMessage: current.lastErrorMessage,
      lastErrorAt: current.lastErrorAt,
      status: "ok",
      lastSuccessAt: new Date().toISOString(),
      consecutiveErrors: 0,
    });
  }

  /**
   * §7: 3 consecutive failures ⇒ broken; anything before that is degraded
   * so a single blip doesn't panic the UI.
   */
  async recordError(
    site: SiteId,
    error?: { code: ScanErrorCode; message: string },
  ): Promise<SiteHealth> {
    const current = await this.get(site);
    const consecutiveErrors = current.consecutiveErrors + 1;
    return this.set(site, {
      ...current,
      ...(error && {
        lastErrorCode: error.code,
        lastErrorMessage: error.message.slice(0, 500),
        lastErrorAt: new Date().toISOString(),
      }),
      status: consecutiveErrors >= 3 ? "broken" : "degraded",
      consecutiveErrors,
      since: current.since ?? new Date().toISOString(),
    });
  }

  private async set(site: SiteId, health: SiteHealth): Promise<SiteHealth> {
    const validated = SiteHealthSchema.parse(health);
    const state = await this.root.read();
    const siteHealth = [...state.siteHealth.filter((h) => h.site !== site), validated];
    await this.root.write({ ...state, siteHealth });
    return validated;
  }
}
