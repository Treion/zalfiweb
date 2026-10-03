import { describe, expect, it } from "vitest";
import { placeOrderSchema } from "@/lib/checkout";
import { isUniqueViolation } from "@/server/db/errors";
import { normalisePhone } from "@/lib/phone";
import {
  evaluateCoupon,
  includedVat,
  shippingFee,
  shippingZone,
  totals,
  type CouponContext,
  type CouponRules,
  type ShippingRules,
} from "@/server/checkout/pricing";
import { OTP, codeMatches, codeState, hashCode, newCode, resendWait } from "@/server/checkout/otp";
import {
  ORDER_STATUSES,
  TRANSITIONS,
  assertTransition,
  canPaymentTransition,
  canTransition,
} from "@/server/orders/state";

const rules: ShippingRules = {
  insideDhakaFee: 7_000,
  outsideDhakaFee: 20_000,
  insideDhakaAreas: ["Dhanmondi", "Gulshan", "Mirpur"],
  freeShippingThreshold: null,
};

describe("phone numbers", () => {
  it.each([
    ["01712345678", "01712345678"],
    ["+8801712345678", "01712345678"],
    ["8801712345678", "01712345678"],
    ["008801712345678", "01712345678"],
    ["+880 1712-345678", "01712345678"],
    ["1712345678", "01712345678"],
    ["01312345678", "01312345678"],
  ])("normalises %s", (input, out) => expect(normalisePhone(input)).toBe(out));

  it.each([
    "0171234567",
    "017123456789",
    "01212345678",
    "02 9876543",
    "abc",
    "",
    "+1 415 555 0100",
  ])("rejects %s", (input) => expect(normalisePhone(input)).toBeNull());
});

describe("shipping", () => {
  it("is inside Dhaka only for Dhaka district areas on the list, in any case", () => {
    expect(shippingZone("Dhaka", "Dhanmondi", rules)).toBe("inside_dhaka");
    expect(shippingZone("Dhaka", " gulshan ", rules)).toBe("inside_dhaka");
    expect(shippingZone("Dhaka", "Savar", rules)).toBe("outside_dhaka");
    expect(shippingZone("Gazipur", "Dhanmondi", rules)).toBe("outside_dhaka");
  });

  it("charges ৳70 inside and ৳200 outside Dhaka", () => {
    expect(shippingFee("inside_dhaka", 450_000, rules)).toBe(7_000);
    expect(shippingFee("outside_dhaka", 450_000, rules)).toBe(20_000);
  });

  it("ships free from the threshold (after discount), or with a free-shipping coupon", () => {
    const r = { ...rules, freeShippingThreshold: 1_000_000 };
    expect(shippingFee("outside_dhaka", 999_900, r)).toBe(20_000);
    expect(shippingFee("outside_dhaka", 1_000_000, r)).toBe(0);
    expect(shippingFee("outside_dhaka", 100, rules, true)).toBe(0);
    // ৳10,500 of bottles with ৳1,000 off is ৳9,500: below a ৳10,000 threshold
    expect(totals(1_050_000, 100_000, "inside_dhaka", r, false).shippingFee).toBe(7_000);
  });

  it("adds up the total, and leaves shipping out until the address is known", () => {
    expect(totals(900_000, 90_000, "inside_dhaka", rules, false)).toEqual({
      subtotal: 900_000,
      discount: 90_000,
      shippingFee: 7_000,
      total: 817_000,
    });
    expect(totals(900_000, 0, null, rules, false).total).toBe(900_000);
    expect(totals(100, 5_000, "inside_dhaka", rules, false).discount).toBe(100);
  });

  it("shows the VAT included in a total", () => {
    expect(includedVat(115_000, 15)).toBe(15_000);
    expect(includedVat(115_000, 0)).toBe(0);
  });
});

describe("coupons", () => {
  const base: CouponRules = {
    code: "ZALFI",
    active: true,
    percentOff: null,
    maxDiscount: null,
    amountOff: null,
    freeShipping: false,
    minSubtotal: null,
    firstOrderOnly: false,
    usageLimit: null,
    perCustomerLimit: null,
    startsAt: null,
    endsAt: null,
    fragranceIds: [],
    variantIds: [],
  };
  const lines = [
    { variantId: 1, fragranceId: 10, lineTotal: 450_000 },
    { variantId: 2, fragranceId: 20, lineTotal: 520_000 },
  ];
  const ctx: CouponContext = {
    lines,
    subtotal: 970_000,
    now: new Date("2026-10-03T10:00:00Z"),
    timesUsed: 0,
    phone: "01712345678",
    usedByPhone: 0,
    ordersByPhone: 0,
  };
  const run = (c: Partial<CouponRules>, x: Partial<CouponContext> = {}) =>
    evaluateCoupon({ ...base, ...c }, { ...ctx, ...x });

  it("takes a percentage off, rounded down to whole taka", () => {
    expect(run({ percentOff: 10 })).toEqual({ ok: true, discount: 97_000, freeShipping: false });
    expect(
      run({ percentOff: 15 }, { subtotal: 1_005, lines: [{ ...lines[0]!, lineTotal: 1_005 }] }),
    ).toMatchObject({ discount: 100 });
  });

  it("caps a percentage at its maximum", () => {
    expect(run({ percentOff: 50, maxDiscount: 100_000 })).toMatchObject({ discount: 100_000 });
  });

  it("takes a fixed amount off, never more than the bottles cost", () => {
    expect(run({ amountOff: 50_000 })).toMatchObject({ discount: 50_000 });
    expect(run({ amountOff: 5_000_000 })).toMatchObject({ discount: 970_000 });
  });

  it("gives free shipping", () => {
    expect(run({ freeShipping: true })).toEqual({ ok: true, discount: 0, freeShipping: true });
  });

  it("needs the minimum order value", () => {
    expect(run({ amountOff: 10_000, minSubtotal: 1_000_000 })).toEqual({
      ok: false,
      message: "That code starts from ৳10,000.",
    });
    expect(run({ amountOff: 10_000, minSubtotal: 970_000 })).toMatchObject({ ok: true });
  });

  it("is first-order only, checked by the verified phone", () => {
    expect(run({ percentOff: 10, firstOrderOnly: true }, { ordersByPhone: 1 })).toMatchObject({
      ok: false,
      message: "That code is for a first order.",
    });
    expect(run({ percentOff: 10, firstOrderOnly: true }, { phone: null })).toMatchObject({
      ok: false,
      message: "Verify your phone number to use that code.",
    });
    expect(run({ percentOff: 10, firstOrderOnly: true })).toMatchObject({ ok: true });
  });

  it("respects the total and per-customer usage limits", () => {
    expect(run({ percentOff: 10, usageLimit: 5 }, { timesUsed: 5 })).toMatchObject({ ok: false });
    expect(run({ percentOff: 10, usageLimit: 5 }, { timesUsed: 4 })).toMatchObject({ ok: true });
    expect(run({ percentOff: 10, perCustomerLimit: 1 }, { usedByPhone: 1 })).toMatchObject({
      ok: false,
      message: "You've already used that code.",
    });
  });

  it("opens and closes on its dates", () => {
    expect(run({ percentOff: 10, startsAt: new Date("2026-10-04T00:00:00Z") })).toMatchObject({
      ok: false,
      message: "That code isn't open yet.",
    });
    expect(run({ percentOff: 10, endsAt: new Date("2026-10-03T10:00:00Z") })).toMatchObject({
      ok: false,
      message: "That code has expired.",
    });
  });

  it("is switched off by its toggle", () => {
    expect(run({ percentOff: 10, active: false })).toMatchObject({ ok: false });
  });

  it("applies only to the fragrances or sizes it names", () => {
    expect(run({ percentOff: 10, fragranceIds: [20] })).toMatchObject({ discount: 52_000 });
    expect(run({ percentOff: 10, variantIds: [1] })).toMatchObject({ discount: 45_000 });
    expect(run({ percentOff: 10, fragranceIds: [99] })).toMatchObject({
      ok: false,
      message: "That code doesn't apply to these bottles.",
    });
  });

  it("combines options on one coupon", () => {
    expect(
      run({ percentOff: 20, maxDiscount: 150_000, freeShipping: true, minSubtotal: 500_000 }),
    ).toEqual({ ok: true, discount: 150_000, freeShipping: true });
  });
});

describe("order state machine", () => {
  it("follows the main path", () => {
    const path = [
      "pending_payment",
      "confirmed",
      "packed",
      "shipped",
      "out_for_delivery",
      "delivered",
    ] as const;
    for (let i = 0; i < path.length - 1; i++)
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("cancels only before shipping", () => {
    for (const s of ORDER_STATUSES)
      expect(canTransition(s, "cancelled")).toBe(
        ["pending_payment", "confirmed", "packed"].includes(s),
      );
  });

  it("handles failed deliveries and returns", () => {
    expect(canTransition("shipped", "delivery_failed")).toBe(true);
    expect(canTransition("delivery_failed", "shipped")).toBe(true);
    expect(canTransition("delivery_failed", "returned")).toBe(true);
    expect(canTransition("delivered", "return_requested")).toBe(true);
    expect(canTransition("return_requested", "returned")).toBe(true);
    expect(canTransition("delivered", "returned")).toBe(false);
  });

  it("never leaves cancelled or returned, and refuses skipping steps", () => {
    expect(TRANSITIONS.cancelled).toEqual([]);
    expect(TRANSITIONS.returned).toEqual([]);
    expect(() => assertTransition("pending_payment", "shipped")).toThrow(
      "An order that is awaiting payment can't become shipped.",
    );
    expect(() => assertTransition("confirmed", "delivered")).toThrow();
  });

  it("tracks payment separately", () => {
    expect(canPaymentTransition("unpaid", "paid")).toBe(true);
    expect(canPaymentTransition("failed", "paid")).toBe(true);
    expect(canPaymentTransition("paid", "partially_refunded")).toBe(true);
    expect(canPaymentTransition("partially_refunded", "refunded")).toBe(true);
    expect(canPaymentTransition("refunded", "paid")).toBe(false);
    expect(canPaymentTransition("unpaid", "refunded")).toBe(false);
  });
});

describe("phone codes", () => {
  const secret = "test-secret";
  it("makes 6-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/);
  });

  it("stores only a hash, tied to the phone", () => {
    const h = hashCode("01712345678", "123456", secret);
    expect(h).not.toContain("123456");
    expect(codeMatches(h, "01712345678", "123456", secret)).toBe(true);
    expect(codeMatches(h, "01712345678", "123457", secret)).toBe(false);
    expect(codeMatches(h, "01812345678", "123456", secret)).toBe(false);
    expect(codeMatches(h, "01712345678", "12345", secret)).toBe(false);
  });

  it("expires after 5 minutes and locks after 5 tries", () => {
    const now = new Date("2026-10-03T10:00:00Z");
    const fresh = { expiresAt: new Date(now.getTime() + 1000), attempts: 0, verifiedAt: null };
    expect(codeState(fresh, now)).toBe("ok");
    expect(codeState({ ...fresh, expiresAt: now }, now)).toBe("expired");
    expect(codeState({ ...fresh, attempts: OTP.maxAttempts }, now)).toBe("locked");
    expect(codeState({ ...fresh, verifiedAt: now }, now)).toBe("used");
    expect(OTP.ttlSeconds).toBe(300);
  });

  it("allows a new code after 60 seconds", () => {
    const now = new Date("2026-10-03T10:01:00Z");
    expect(resendWait(null, now)).toBe(0);
    expect(resendWait(new Date("2026-10-03T10:00:30Z"), now)).toBe(30);
    expect(resendWait(new Date("2026-10-03T10:00:00Z"), now)).toBe(0);
  });
});

describe("checkout input", () => {
  const valid = {
    name: "Nusrat Jahan",
    phone: "+880 1712 345678",
    email: "Nusrat@Example.com",
    district: "Dhaka",
    area: "Dhanmondi",
    street: "House 12, Road 5",
    items: [{ sku: "ZLF-REVA-50", qty: 1 }],
    paymentMethod: "cod",
    expectedTotal: 457_000,
    idempotencyKey: "abcdefghijklmnop1234",
  };

  it("normalises phone and email", () => {
    const r = placeOrderSchema.parse(valid);
    expect(r.phone).toBe("01712345678");
    expect(r.email).toBe("nusrat@example.com");
  });

  it("rejects unknown fields, bad districts and client-side prices", () => {
    expect(placeOrderSchema.safeParse({ ...valid, price: 1 }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, district: "Atlantis" }).success).toBe(false);
    expect(
      placeOrderSchema.safeParse({ ...valid, items: [{ sku: "X", qty: 1, pricePoisha: 1 }] })
        .success,
    ).toBe(false);
    expect(placeOrderSchema.safeParse({ ...valid, items: [{ sku: "X", qty: 11 }] }).success).toBe(
      false,
    );
  });
});

describe("database errors", () => {
  it("finds a unique violation inside drizzle's wrapper", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(
      isUniqueViolation(Object.assign(new Error("Failed query"), { cause: { code: "23505" } })),
    ).toBe(true);
    expect(isUniqueViolation(new Error("other"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
