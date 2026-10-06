import { describe, expect, it } from "vitest";
import { orderNumberOf, trackSchema } from "@/server/orders/track";

describe("track your order", () => {
  it("reads an order number however it's typed", () => {
    expect(orderNumberOf("ZLF-001234")).toBe("ZLF-001234");
    expect(orderNumberOf("zlf 1234")).toBe("ZLF-001234");
    expect(orderNumberOf(" #1234 ")).toBe("ZLF-001234");
    expect(orderNumberOf("42")).toBe("ZLF-000042");
  });

  it("refuses what can't be an order number", () => {
    expect(orderNumberOf("")).toBeNull();
    expect(orderNumberOf("ZLF-")).toBeNull();
    expect(orderNumberOf("1234567")).toBeNull();
    expect(orderNumberOf("abc12")).toBeNull();
  });

  it("takes only the number and a Bangladeshi phone", () => {
    expect(trackSchema.safeParse({ number: "ZLF-001234", phone: "01712345678" }).success).toBe(
      true,
    );
    expect(trackSchema.safeParse({ number: "ZLF-001234", phone: "12345" }).success).toBe(false);
    expect(trackSchema.safeParse({ number: "1", phone: "01712345678", token: "x" }).success).toBe(
      false,
    );
  });
});
