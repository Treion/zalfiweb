import { describe, expect, it } from "vitest";
import { FRAGRANCES } from "@/db/seed-data";
import {
  NO_FILTERS,
  filtersToQuery,
  parseSort,
  queryWithSort,
  sortFragrances,
} from "@/lib/collection";

const names = (list: { name: string }[]) => list.map((f) => f.name);

describe("shop sort", () => {
  it("keeps the house's order by default", () => {
    expect(names(sortFragrances(FRAGRANCES, "featured"))).toEqual(names(FRAGRANCES));
  });

  it("sorts by price both ways, ties in the house's order", () => {
    const up = sortFragrances(FRAGRANCES, "price-asc");
    const prices = up.map((f) => f.variants[0]!.pricePoisha);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const down = sortFragrances(FRAGRANCES, "price-desc");
    expect(down[0]!.variants[0]!.pricePoisha).toBe(Math.max(...prices));
  });

  it("puts the best reviewed first, then the most reviewed", () => {
    const top = sortFragrances(FRAGRANCES, "rating", {
      bond: { average: 4.8, count: 3 },
      maree: { average: 4.8, count: 9 },
      reva: { average: 4.2, count: 20 },
    });
    expect(names(top).slice(0, 3)).toEqual(["Maree", "Bond", "Reva"]);
  });

  it("reads and writes the sort beside the filters, leaving out the default", () => {
    expect(parseSort(new URLSearchParams("sort=price-asc"))).toBe("price-asc");
    expect(parseSort(new URLSearchParams("sort=nonsense"))).toBe("featured");
    expect(queryWithSort(filtersToQuery(NO_FILTERS), "featured")).toBe("");
    expect(queryWithSort("", "price-desc")).toBe("?sort=price-desc");
    expect(queryWithSort("?wear=evening", "rating")).toBe("?wear=evening&sort=rating");
  });
});
