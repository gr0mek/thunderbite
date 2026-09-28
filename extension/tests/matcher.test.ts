import { describe, expect, it } from "vitest";
import { matchesOffer, normalizeForMatch } from "@/core/matcher";
import type { NormalizedOffer } from "@/adapters/types";

function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    site: "vinted",
    externalId: "1",
    url: "https://vinted.pl/oferta/1",
    title: "Leica M6 czarna, stan bardzo dobry",
    price: 4200,
    currency: "PLN",
    ...overrides,
  };
}

const baseWatch = {
  keywords: ["Leica M6"],
  excludeKeywords: [] as string[],
  priceMin: undefined as number | undefined,
  priceMax: undefined as number | undefined,
};

describe("normalizeForMatch", () => {
  it("lowercases, trims, and strips Polish diacritics (§7)", () => {
    expect(normalizeForMatch("  Łódź kurtka zimowa ĄĘŚŻŹĆŃÓŁ  ")).toBe(
      "lodz kurtka zimowa aeszzcnol",
    );
  });
});

describe("matchesOffer", () => {
  it("matches when the title contains any keyword, case/diacritic-insensitive", () => {
    expect(matchesOffer(baseWatch, offer({ title: "leica m6 TTL 0.72" }))).toBe(true);
    expect(
      matchesOffer(
        { ...baseWatch, keywords: ["Łódź"] },
        offer({ title: "sprzedam w lodzi" }),
      ),
    ).toBe(true);
  });

  it("rejects when no keyword matches", () => {
    expect(matchesOffer(baseWatch, offer({ title: "Nikon FM2" }))).toBe(false);
  });

  it("rejects when an excluded word is present", () => {
    expect(
      matchesOffer(
        { ...baseWatch, excludeKeywords: ["uszkodzony"] },
        offer({ title: "Leica M6 uszkodzony wyświetlacz" }),
      ),
    ).toBe(false);
  });

  it("enforces price bounds when the offer has a known price", () => {
    expect(matchesOffer({ ...baseWatch, priceMax: 4000 }, offer({ price: 4200 }))).toBe(
      false,
    );
    expect(matchesOffer({ ...baseWatch, priceMin: 5000 }, offer({ price: 4200 }))).toBe(
      false,
    );
    expect(
      matchesOffer(
        { ...baseWatch, priceMin: 4000, priceMax: 4500 },
        offer({ price: 4200 }),
      ),
    ).toBe(true);
  });

  it("never excludes an offer on price alone when the price is unknown", () => {
    expect(matchesOffer({ ...baseWatch, priceMax: 100 }, offer({ price: null }))).toBe(
      true,
    );
  });
});
