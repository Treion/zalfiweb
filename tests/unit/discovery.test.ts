import { describe, expect, it } from "vitest";
import { companions, setsFor, type DiscoverySet } from "@/lib/discovery";
import { sizeLabel } from "@/lib/size";
import { evaluateCoupon, type CouponContext, type CouponRules } from "@/server/checkout/pricing";
import { newSetSchema, setFragrancesSchema, setPackSchema } from "@/server/catalog/schema";
import { DISCOVERY_SETS, FRAGRANCES } from "@/db/seed-data";

describe("sizes", () => {
  it("reads a bottle as its size, and a pack as vials × size", () => {
    expect(sizeLabel(50)).toBe("50 ml");
    expect(sizeLabel(50, 1)).toBe("50 ml");
    expect(sizeLabel(3, 3)).toBe("3 × 3 ml");
  });
});

describe("discovery sets", () => {
  it("hold exactly three different fragrances", () => {
    expect(setFragrancesSchema.safeParse([1, 2, 3]).success).toBe(true);
    expect(setFragrancesSchema.safeParse([1, 2]).success).toBe(false);
    expect(setFragrancesSchema.safeParse([1, 2, 3, 4]).success).toBe(false);
    expect(setFragrancesSchema.safeParse([1, 1, 2]).success).toBe(false);
  });

  it("refuse unknown fields and silly packs", () => {
    expect(
      setPackSchema.safeParse({
        sizeMl: 3,
        pricePoisha: 150_000,
        lowStockThreshold: null,
        active: true,
      }).success,
    ).toBe(true);
    expect(
      setPackSchema.safeParse({
        sizeMl: 0,
        pricePoisha: 150_000,
        lowStockThreshold: null,
        active: true,
      }).success,
    ).toBe(false);
    expect(
      newSetSchema.safeParse({
        name: "Black Set",
        slug: "black",
        tagline: "Frost, glass and tide.",
        imageAlt: "A black box with three vials",
        fragranceIds: [1, 2, 3],
        sizeMl: 3,
        pricePoisha: 150_000,
        pieces: 5,
      }).success,
    ).toBe(false);
  });

  it("seed: the black box holds the fresh three and the navy the warm three, 3 × 3 ml each", () => {
    const by = Object.fromEntries(DISCOVERY_SETS.map((s) => [s.slug, s]));
    expect(by.black!.fragrances.map((f) => f.slug)).toEqual(["reva", "riven", "maree"]);
    expect(by.navy!.fragrances.map((f) => f.slug)).toEqual(["solea", "bond", "oudor"]);
    for (const s of DISCOVERY_SETS) {
      expect(s.variant).toMatchObject({ sizeMl: 3, pieces: 3 });
      expect(s.image).toMatch(/^\/images\/sets\/.+\.webp$/);
    }
    // Every fragrance is in exactly one set
    const all = DISCOVERY_SETS.flatMap((s) => s.fragrances.map((f) => f.slug)).sort();
    expect(all).toEqual(FRAGRANCES.map((f) => f.slug).sort());
  });

  it("find the set a fragrance is in, and its companions", () => {
    const sets = DISCOVERY_SETS as DiscoverySet[];
    expect(setsFor(sets, "riven").map((s) => s.slug)).toEqual(["black"]);
    expect(companions(setsFor(sets, "riven")[0]!, "riven")).toEqual(["Reva", "Maree"]);
    expect(setsFor(sets, "nope")).toEqual([]);
    // A set that isn't for sale hints at nothing
    expect(setsFor([{ ...sets[0]!, variant: null }], "riven")).toEqual([]);
  });
});

describe("coupons and sets", () => {
  const base: CouponRules = {
    code: "SETS",
    active: true,
    percentOff: 10,
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
  // A bottle of fragrance 10, and a discovery set (no fragrance of its own) with pack 7
  const ctx: CouponContext = {
    lines: [
      { variantId: 1, fragranceId: 10, lineTotal: 450_000 },
      { variantId: 7, fragranceId: null, lineTotal: 150_000 },
    ],
    subtotal: 600_000,
    now: new Date("2026-10-05T10:00:00Z"),
    timesUsed: 0,
    phone: "01712345678",
    usedByPhone: 0,
    ordersByPhone: 0,
  };
  const run = (c: Partial<CouponRules>) => evaluateCoupon({ ...base, ...c }, ctx);

  it("an open coupon counts the set too", () => {
    expect(run({})).toMatchObject({ ok: true, discount: 60_000 });
  });
  it("a coupon for a fragrance doesn't reach a set", () => {
    expect(run({ fragranceIds: [10] })).toMatchObject({ discount: 45_000 });
  });
  it("a coupon for a set's pack takes off the set only", () => {
    expect(run({ variantIds: [7] })).toMatchObject({ discount: 15_000 });
  });
});
