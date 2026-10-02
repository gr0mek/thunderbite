import { describe, expect, it } from "vitest";
import {
  formatAuctionMeta,
  formatPrice,
  formatShipping,
  formatTimeLeft,
} from "@/shared/format";

describe("formatPrice", () => {
  it("keeps the Polish zł format by default", () => {
    expect(formatPrice(4200)).toBe("4 200 zł");
    expect(formatPrice(149.5, "PLN")).toBe("150 zł");
    expect(formatPrice(null, "USD")).toBe("—");
  });

  it("shows dollars eBay-style, with cents only when there are any", () => {
    expect(formatPrice(1250, "USD")).toBe("$1,250");
    expect(formatPrice(12.99, "USD")).toBe("$12.99");
    expect(formatPrice(38.5, "USD")).toBe("$38.50");
    expect(formatPrice(9.999, "USD")).toBe("$10");
    expect(formatPrice(20, "EUR")).toBe("20 EUR");
  });
});

describe("formatShipping", () => {
  it("labels paid, free and unknown shipping", () => {
    expect(formatShipping({ shippingCost: 38.5, currency: "USD" })).toBe(
      "+ $38.50 wysyłka",
    );
    expect(formatShipping({ shippingCost: 0, currency: "USD" })).toBe("darmowa wysyłka");
    expect(formatShipping({ currency: "USD" })).toBeNull();
  });
});

describe("auction labels", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");

  it("counts down to the end", () => {
    expect(formatTimeLeft("2026-10-02T12:30:00Z", now)).toBe("za 30 min");
    expect(formatTimeLeft("2026-10-02T17:10:00Z", now)).toBe("za 5 h");
    expect(formatTimeLeft("2026-10-05T12:00:00Z", now)).toBe("za 3 dni");
    expect(formatTimeLeft("2026-10-02T11:00:00Z", now)).toBeNull();
  });

  it("combines bids and time left", () => {
    expect(
      formatAuctionMeta(
        { auction: { bidCount: 7, endsAt: "2026-10-03T13:00:00Z" } },
        now,
      ),
    ).toBe("7 ofert · koniec za 1 dzień");
    expect(formatAuctionMeta({ auction: { endsAt: "2026-10-01T00:00:00Z" } }, now)).toBe(
      "zakończona",
    );
    expect(formatAuctionMeta({}, now)).toBeNull();
  });
});
