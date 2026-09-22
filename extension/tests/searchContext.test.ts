import { describe, expect, it } from "vitest";
import { detectSearchContext } from "@/adapters/searchContext";
import type { SiteId } from "@/adapters/types";

// Detection is intentionally stubbed until real fixtures are available
// (docs/adr-001-adapter-fixture-blocker.md) — this test documents that,
// so a future implementer removes it deliberately rather than by accident.
describe("detectSearchContext", () => {
  it("returns null for every site (stub, pending real fixtures)", () => {
    const sites: SiteId[] = ["olx", "vinted", "allegro"];
    for (const site of sites) {
      expect(
        detectSearchContext(site, new URL("https://example.com/search?q=test"), document),
      ).toBeNull();
    }
  });
});
