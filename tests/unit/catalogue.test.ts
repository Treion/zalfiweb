import { describe, expect, it } from "vitest";
import { resolveBottle } from "@/lib/bottle";
import { AA_TEXT, contrastRatio } from "@/lib/contrast";
import { countWord, listNames } from "@/lib/words";
import { FRAGRANCES } from "@/db/seed-data";
import {
  fragranceDetailsSchema,
  paletteSchema,
  slugSchema,
  stockAdjustSchema,
  variantSchema,
} from "@/server/catalog/schema";
import { availableOf, effectiveThreshold, stockLevel } from "@/server/catalog/stock";

describe("contrast", () => {
  it("matches WCAG for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("every launch world's text reads on its background (AA or better)", () => {
    for (const f of FRAGRANCES)
      expect(contrastRatio(f.palette.ink, f.palette.bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("catalogue rules", () => {
  it("accepts every launch palette and rejects unreadable text", () => {
    for (const f of FRAGRANCES) expect(paletteSchema.safeParse(f.palette).success).toBe(true);
    const bad = paletteSchema.safeParse({
      bg: "#777777",
      deep: "#000000",
      accent: "#ffffff",
      ink: "#888888",
    });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["ink"]);
  });
  it("rejects malformed colours and unknown fields", () => {
    expect(
      paletteSchema.safeParse({ bg: "red", deep: "#000000", accent: "#fff", ink: "#ffffff" })
        .success,
    ).toBe(false);
    expect(
      paletteSchema.safeParse({
        bg: "#000000",
        deep: "#000000",
        accent: "#ffffff",
        ink: "#ffffff",
        x: 1,
      }).success,
    ).toBe(false);
  });
  it("keeps web addresses simple", () => {
    expect(slugSchema.parse(" Oud-Noir ")).toBe("oud-noir");
    for (const bad of ["9lives", "a", "has space", "café", "-x"])
      expect(slugSchema.safeParse(bad).success).toBe(false);
  });
  it("validates sizes: SKU format, price at least ৳1", () => {
    const ok = variantSchema.parse({
      sizeMl: 50,
      sku: "zlf-reva-50",
      pricePoisha: 450_000,
      lowStockThreshold: null,
      active: true,
    });
    expect(ok.sku).toBe("ZLF-REVA-50");
    expect(variantSchema.safeParse({ ...ok, pricePoisha: 50 }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, sku: "a b" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...ok, sizeMl: 0 }).success).toBe(false);
  });
  it("accepts a launch fragrance's details as they are", () => {
    const f = FRAGRANCES[0]!;
    const r = fragranceDetailsSchema.safeParse({
      name: f.name,
      tagline: f.tagline,
      mood: f.mood,
      story: f.story,
      bottleAlt: f.bottleAlt,
      capFinish: f.capFinish,
      palette: f.palette,
      profile: f.profile,
      sortOrder: f.sortOrder,
      published: true,
    });
    expect(r.success).toBe(true);
  });
  it("stock adjustments need a non-zero count, and a note for 'Other'", () => {
    const base = { variantId: 1, delta: 5, reason: "restock", note: "" };
    expect(stockAdjustSchema.safeParse(base).success).toBe(true);
    expect(stockAdjustSchema.safeParse({ ...base, delta: 0 }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ ...base, reason: "other" }).success).toBe(false);
    expect(
      stockAdjustSchema.safeParse({ ...base, reason: "other", note: "Shop display" }).success,
    ).toBe(true);
  });
});

describe("stock levels", () => {
  it("available is stock minus held, never negative", () => {
    expect(availableOf(10, 3)).toBe(7);
    expect(availableOf(2, 5)).toBe(0);
  });
  it("uses a size's own threshold, else the default", () => {
    expect(effectiveThreshold(null, 5)).toBe(5);
    expect(effectiveThreshold(2, 5)).toBe(2);
    expect(effectiveThreshold(0, 5)).toBe(0);
  });
  it("labels out, low and ok", () => {
    expect(stockLevel(0, 5)).toBe("out");
    expect(stockLevel(5, 5)).toBe("low");
    expect(stockLevel(6, 5)).toBe("ok");
  });
});

describe("bottle data", () => {
  it("uses the generated data for launch bottles", () => {
    const b = resolveBottle("reva");
    expect(b.maps).toBe("/images/bottles/maps/reva");
    expect(b.meta.trim.w).toBeGreaterThan(0);
  });
  it("prefers an uploaded photo's data", () => {
    const meta = { ...resolveBottle("reva").meta, shoulder: 0.5 };
    expect(resolveBottle("reva", meta, "/media/bottles/reva-abc")).toEqual({
      meta,
      maps: "/media/bottles/reva-abc",
    });
  });
  it("falls back safely for a bottle without a photo yet (no maps: the stage leaves it to the DOM photo)", () => {
    const b = resolveBottle("brand-new");
    expect(b.maps).toBeNull();
    expect(b.meta.trim).toEqual({ x: 0, y: 0, w: 2000, h: 2000 });
  });
});

describe("words", () => {
  it("spells counts and lists names", () => {
    expect(countWord(6, true)).toBe("Six");
    expect(countWord(7)).toBe("seven");
    expect(countWord(13)).toBe("13");
    expect(listNames(["Reva", "Riven", "Oudor"])).toBe("Reva, Riven and Oudor");
    expect(listNames(["Reva"])).toBe("Reva");
  });
});
