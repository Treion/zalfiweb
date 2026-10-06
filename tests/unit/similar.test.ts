import { describe, expect, it } from "vitest";
import { FRAGRANCES } from "@/db/seed-data";
import { similarWorlds } from "@/lib/finder";

const bySlug = (s: string) => FRAGRANCES.find((f) => f.slug === s)!;
const names = (s: string) => similarWorlds(bySlug(s), FRAGRANCES).map((f) => f.slug);

describe("similar worlds", () => {
  it("gives two others, never the fragrance itself", () => {
    for (const f of FRAGRANCES) {
      const s = similarWorlds(f, FRAGRANCES);
      expect(s).toHaveLength(2);
      expect(s.map((x) => x.slug)).not.toContain(f.slug);
    }
  });

  it("pairs the evening woods together, and the day greens together", () => {
    expect(names("bond")).toContain("oudor");
    expect(names("oudor")).toContain("bond");
    expect(names("riven")).toContain("reva");
  });

  it("is predictable: the same answer every time", () => {
    expect(names("maree")).toEqual(names("maree"));
  });
});
