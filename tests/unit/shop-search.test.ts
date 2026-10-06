import { describe, expect, it } from "vitest";
import { DISCOVERY_SETS, FRAGRANCES } from "@/db/seed-data";
import { POPULAR, buildSearchIndex, popularSearches, searchEntries } from "@/lib/shop-search";

const index = buildSearchIndex(FRAGRANCES, DISCOVERY_SETS);
const names = (q: string) => searchEntries(index, q).map((e) => e.name);

describe("header search", () => {
  it("finds a fragrance by its name, first", () => {
    expect(names("reva")[0]).toBe("Reva");
    expect(names("REV")[0]).toBe("Reva");
  });

  it("finds fragrances by a note, a family or a moment", () => {
    expect(names("oud")).toContain("Oudor");
    expect(names("evening").length).toBeGreaterThan(0);
    expect(names("fougère")).toContain("Reva");
    expect(names("fougere")).toContain("Reva");
  });

  it("needs every word to match, at the start of a word", () => {
    const all = names("oud");
    expect(names("oud rose").every((n) => all.includes(n))).toBe(true);
    expect(names("zzzz")).toEqual([]);
    expect(names("   ")).toEqual([]);
  });

  it("finds the discovery sets and the house pages", () => {
    expect(names("discovery").some((n) => /set/i.test(n))).toBe(true);
    expect(names("track")).toContain("Track your order");
    expect(names("cash")).toContain("Delivery and payment");
  });

  it("carries what one-tap Add needs", () => {
    const reva = searchEntries(index, "reva")[0]!;
    expect(reva.buy).toMatchObject({ slug: "reva", sizeMl: 50 });
    expect(reva.href).toBe("/fragrances/reva");
  });

  it("suggests only words that find something", () => {
    const popular = popularSearches(index, [...POPULAR, "Zzz"]);
    expect(popular).not.toContain("Zzz");
    expect(popular.length).toBeGreaterThan(0);
    expect(popular.length).toBeLessThanOrEqual(4);
  });
});
