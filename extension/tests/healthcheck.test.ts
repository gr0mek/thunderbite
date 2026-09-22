import { describe, expect, it } from "vitest";
import { runHealthChecks } from "@/core/healthcheck";
import type { AdapterHealth, SiteAdapter, SiteId } from "@/adapters/types";
import { Logger } from "@/shared/logger";
import { LogRepo } from "@/storage/logRepo";
import { RootStore } from "@/storage/rootStore";
import { MemoryStore } from "@/storage/local";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";

function adapterReturning(result: AdapterHealth | Error): SiteAdapter {
  return {
    id: "olx",
    minIntervalMs: 1,
    search: async () => [],
    healthCheck: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("runHealthChecks", () => {
  it("records success for a healthy adapter and error for degraded/broken/throwing ones", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));

    const adapters: Record<SiteId, SiteAdapter> = {
      olx: adapterReturning("ok"),
      vinted: adapterReturning("degraded"),
      allegro: adapterReturning(new Error("timeout")),
    };

    await runHealthChecks({ adapters, siteHealth, logger });

    const [olx, vinted, allegro] = await Promise.all([
      siteHealth.get("olx"),
      siteHealth.get("vinted"),
      siteHealth.get("allegro"),
    ]);
    expect(olx.status).toBe("ok");
    expect(olx.consecutiveErrors).toBe(0);
    expect(vinted.status).toBe("degraded");
    expect(vinted.consecutiveErrors).toBe(1);
    expect(allegro.status).toBe("degraded");
    expect(allegro.consecutiveErrors).toBe(1);
  });

  it("reaches broken after 3 consecutive unhealthy checks", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));
    const adapters: Record<SiteId, SiteAdapter> = {
      olx: adapterReturning("broken"),
      vinted: adapterReturning("ok"),
      allegro: adapterReturning("ok"),
    };

    await runHealthChecks({ adapters, siteHealth, logger });
    await runHealthChecks({ adapters, siteHealth, logger });
    await runHealthChecks({ adapters, siteHealth, logger });

    expect((await siteHealth.get("olx")).status).toBe("broken");
  });
});
