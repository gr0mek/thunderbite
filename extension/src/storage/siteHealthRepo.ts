import { SiteHealthSchema, type SiteHealth } from "@/shared/schemas";
import type { SiteId } from "@/adapters/types";
import type { RootStore } from "./rootStore";

const ALL_SITES: SiteId[] = ["olx", "vinted", "allegro"];

export class SiteHealthRepo {
  constructor(private readonly root: RootStore) {}

  async list(): Promise<SiteHealth[]> {
    const state = await this.root.read();
    const bySite = new Map(state.siteHealth.map((h) => [h.site, h]));
    // Always return all three sites, even before any check has run.
    return ALL_SITES.map((site) => bySite.get(site) ?? SiteHealthSchema.parse({ site }));
  }

  async get(site: SiteId): Promise<SiteHealth> {
    return (await this.list()).find((h) => h.site === site) as SiteHealth;
  }

  async recordSuccess(site: SiteId): Promise<SiteHealth> {
    return this.set(site, {
      site,
      status: "ok",
      lastSuccessAt: new Date().toISOString(),
      consecutiveErrors: 0,
    });
  }

  /**
   * §7: 3 consecutive failures ⇒ broken; anything before that is degraded
   * so a single blip doesn't panic the UI.
   */
  async recordError(site: SiteId): Promise<SiteHealth> {
    const current = await this.get(site);
    const consecutiveErrors = current.consecutiveErrors + 1;
    return this.set(site, {
      ...current,
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
