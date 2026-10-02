import { describe, expect, it } from "vitest";
import { formatPrice, poishaToTaka, takaToPoisha } from "@/lib/money";

describe("money (poisha, BDT)", () => {
  it("formats whole taka without poisha", () => {
    expect(formatPrice(125_000)).toBe("৳1,250");
    expect(formatPrice(0)).toBe("৳0");
  });
  it("uses Bangladeshi lakh grouping", () => {
    expect(formatPrice(12_500_000)).toBe("৳1,25,000");
    expect(formatPrice(1_000_000_000)).toBe("৳1,00,00,000");
  });
  it("shows poisha only when present", () => {
    expect(formatPrice(12_550)).toBe("৳125.50");
  });
  it("formats negatives (refunds)", () => {
    expect(formatPrice(-50_000)).toBe("−৳500");
  });
  it("converts taka and poisha", () => {
    expect(takaToPoisha(70)).toBe(7_000);
    expect(takaToPoisha(0.1 + 0.2)).toBe(30);
    expect(poishaToTaka(20_000)).toBe(200);
  });
});
