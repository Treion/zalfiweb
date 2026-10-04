import { describe, expect, it } from "vitest";
import { phoneDigits } from "@/server/search";

describe("phone matching", () => {
  it("reads a Bangladeshi mobile number however it's typed", () => {
    for (const typed of ["01712-345678", "+880 1712 345678", "8801712345678", "1712345678"])
      expect(phoneDigits(typed)).toBe("1712345678");
    expect(phoneDigits("0171")).toBe("171");
    expect(phoneDigits("12")).toBeNull();
    expect(phoneDigits("Oudor")).toBeNull();
  });
});
