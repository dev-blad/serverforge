import { describe, expect, it } from "vitest";
import { computeTotals, validateDiscount, type DiscountLike } from "@/lib/pricing";
import { vatFromInclusive, formatPrice, poundsToPence } from "@/lib/money";
import { normalisePostcode, parseOrderNumber, UK_POSTCODE, formatOrderNumber } from "@/lib/utils";
import { addWorkingDays } from "@/lib/shipping-rates";

const disc = (o: Partial<DiscountLike>): DiscountLike => ({
  code: "X", type: "PERCENT", value: 10, minSubtotal: 0, startsAt: null, endsAt: null, usageLimit: null, usageCount: 0, active: true, ...o,
});

describe("computeTotals", () => {
  it("charges shipping under the free threshold and includes VAT", () => {
    const t = computeTotals({ lines: [{ unitPrice: 649, quantity: 2 }], shippingMethodId: "rm-tracked48" });
    expect(t.subtotal).toBe(1298);
    expect(t.shippingTotal).toBe(399);
    expect(t.total).toBe(1697);
    expect(t.taxTotal).toBe(vatFromInclusive(1697));
    expect(t.freeShippingRemaining).toBe(5000 - 1298);
  });

  it("makes standard shipping free at £50 but not Tracked 24", () => {
    const lines = [{ unitPrice: 5000, quantity: 1 }];
    expect(computeTotals({ lines, shippingMethodId: "rm-tracked48" }).shippingTotal).toBe(0);
    expect(computeTotals({ lines, shippingMethodId: "evri-48" }).shippingTotal).toBe(0);
    expect(computeTotals({ lines, shippingMethodId: "rm-tracked24" }).shippingTotal).toBe(599);
  });

  it("applies the free-shipping threshold after discounts", () => {
    const t = computeTotals({ lines: [{ unitPrice: 5200, quantity: 1 }], shippingMethodId: "rm-tracked48", discount: disc({ value: 10 }) });
    expect(t.discountTotal).toBe(520);
    expect(t.shippingTotal).toBe(399);
  });

  it("caps fixed discounts at the subtotal", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], discount: disc({ type: "FIXED", value: 5000 }) });
    expect(t.discountTotal).toBe(1000);
  });

  it("FREE_SHIPPING codes zero any method", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], shippingMethodId: "rm-tracked24", discount: disc({ type: "FREE_SHIPPING" }) });
    expect(t.shippingTotal).toBe(0);
    expect(t.total).toBe(1000);
  });

  it("ignores invalid discounts", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], discount: disc({ endsAt: new Date(Date.now() - 1000) }) });
    expect(t.discountTotal).toBe(0);
  });

  it("treats gift cards as payment: VAT computed before redemption", () => {
    const t = computeTotals({
      lines: [{ unitPrice: 6000, quantity: 1 }],
      shippingMethodId: "rm-tracked48",
      giftCard: { code: "G", balance: 2500, active: true, expiresAt: null },
    });
    expect(t.giftCardTotal).toBe(2500);
    expect(t.total).toBe(3500);
    expect(t.taxTotal).toBe(vatFromInclusive(6000));
  });

  it("gift card can cover the whole order", () => {
    const t = computeTotals({ lines: [{ unitPrice: 1000, quantity: 1 }], shippingMethodId: "rm-tracked48", giftCard: { code: "G", balance: 50000, active: true, expiresAt: null } });
    expect(t.total).toBe(0);
    expect(t.giftCardTotal).toBe(1399);
  });
});

describe("validateDiscount", () => {
  it("enforces minimum spend, usage limit, dates and active flag", () => {
    expect(validateDiscount(disc({ minSubtotal: 10000 }), 9999).ok).toBe(false);
    expect(validateDiscount(disc({ minSubtotal: 10000 }), 10000).ok).toBe(true);
    expect(validateDiscount(disc({ usageLimit: 5, usageCount: 5 }), 100).ok).toBe(false);
    expect(validateDiscount(disc({ startsAt: new Date(Date.now() + 86400000) }), 100).ok).toBe(false);
    expect(validateDiscount(disc({ active: false }), 100).ok).toBe(false);
    expect(validateDiscount(null, 100).ok).toBe(false);
  });
});

describe("utils", () => {
  it("formats GBP and parses pounds", () => {
    expect(formatPrice(12999)).toBe("£129.99");
    expect(poundsToPence("£1,234.50")).toBe(123450);
    expect(Number.isNaN(poundsToPence("abc"))).toBe(true);
  });
  it("validates and normalises UK postcodes", () => {
    for (const pc of ["M4 6DE", "sw1a1aa", "EC1A 1BB", "B33 8TH", "CR2 6XH", "DN55 1PT", "GIR 0AA"]) expect(UK_POSTCODE.test(pc)).toBe(true);
    for (const pc of ["12345", "ABC", "M4 6D"]) expect(UK_POSTCODE.test(pc)).toBe(false);
    expect(normalisePostcode("sw1a1aa")).toBe("SW1A 1AA");
  });
  it("round-trips order numbers", () => {
    expect(formatOrderNumber(42)).toBe("CL-10042");
    expect(parseOrderNumber("cl-10042")).toBe(42);
    expect(parseOrderNumber("10042")).toBe(42);
    expect(parseOrderNumber("nope")).toBeNull();
  });
  it("skips weekends when adding working days", () => {
    const fri = new Date("2026-11-13T10:00:00Z");
    expect(addWorkingDays(fri, 1).getUTCDay()).toBe(1);
  });
});
