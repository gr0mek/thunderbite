import { describe, expect, it } from "vitest";
import { runHealthChecks } from "@/core/healthcheck";
import { createUnconfiguredAdapter } from "@/adapters/fake";
import type { AdapterHealth, SiteAdapter, SiteId } from "@/adapters/types";
import { Logger } from "@/shared/logger";
import { LogRepo } from "@/storage/logRepo";
import { RootStore } from "@/storage/rootStore";
import { MemoryStore } from "@/storage/local";
import { SiteHealthRepo } from "@/storage/siteHealthRepo";

function adapterReturning(result: AdapterHealth | Error): SiteAdapter {
  return {
    id: "vinted",
    minIntervalMs: 1,
    search: async () => [],
    healthCheck: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("runHealthChecks", () => {
  it("records success for a healthy adapter", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));

    await runHealthChecks({
      adapters: {
        vinted: adapterReturning("ok"),
        ebay: createUnconfiguredAdapter("ebay"),
      },
      siteHealth,
      logger,
    });

    const vinted = await siteHealth.get("vinted");
    expect(vinted.status).toBe("ok");
    expect(vinted.consecutiveErrors).toBe(0);
  });

  it("records degraded when the adapter throws", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));

    await runHealthChecks({
      adapters: {
        vinted: adapterReturning(new Error("timeout")),
        ebay: createUnconfiguredAdapter("ebay"),
      },
      siteHealth,
      logger,
    });

    const vinted = await siteHealth.get("vinted");
    expect(vinted.status).toBe("degraded");
    expect(vinted.consecutiveErrors).toBe(1);
  });

  it("reaches broken after 3 consecutive unhealthy checks", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const logger = new Logger(new LogRepo(root));
    const adapters: Record<SiteId, SiteAdapter> = {
      vinted: adapterReturning("broken"),
      ebay: createUnconfiguredAdapter("ebay"),
    };

    await runHealthChecks({ adapters, siteHealth, logger });
    await runHealthChecks({ adapters, siteHealth, logger });
    await runHealthChecks({ adapters, siteHealth, logger });

    expect((await siteHealth.get("vinted")).status).toBe("broken");
  });
});

describe("runHealthChecks with an unconfigured site", () => {
  it("skips it instead of reporting a problem", async () => {
    const root = new RootStore(new MemoryStore());
    const siteHealth = new SiteHealthRepo(root);
    const records = await runHealthChecks({
      adapters: {
        vinted: adapterReturning("ok"),
        ebay: createUnconfiguredAdapter("ebay"),
      },
      siteHealth,
      logger: new Logger(new LogRepo(root)),
    });
    expect(records.map((r) => r.site)).toEqual(["vinted"]);
    expect((await siteHealth.get("ebay")).consecutiveErrors).toBe(0);
  });
});
