import { describe, expect, it } from "vitest";
import { giftNoteSize, renderGiftCard } from "@/server/invoice/gift-card";
import { giftMessageSchema, placeOrderSchema } from "@/lib/checkout";

describe("gift note", () => {
  it("keeps the customer's words, trims them and treats blank as no gift", () => {
    expect(giftMessageSchema.parse("  For you.\r\n\r\n\r\nLove, R  ")).toBe("For you.\n\nLove, R");
    expect(giftMessageSchema.parse("   ")).toBeNull();
    expect(giftMessageSchema.safeParse("x".repeat(201)).success).toBe(false);
  });

  it("is optional when placing an order", () => {
    const base = {
      name: "Nusrat Jahan",
      phone: "01712345678",
      email: "n@example.com",
      district: "Dhaka",
      area: "Dhanmondi",
      street: "Road 7A, House 21",
      items: [{ sku: "ZLF-REVA-50", qty: 1 }],
      paymentMethod: "cod",
      expectedTotal: 0,
      idempotencyKey: "abcdefghijklmnop",
    };
    const plain = placeOrderSchema.safeParse(base);
    expect(plain.success && plain.data.giftMessage).toBeFalsy();
    const gift = placeOrderSchema.safeParse({ ...base, giftMessage: "Happy birthday" });
    expect(gift.success && gift.data.giftMessage).toBe("Happy birthday");
  });

  it("sets short notes larger", () => {
    expect(giftNoteSize("Happy birthday")).toBeGreaterThan(giftNoteSize("x".repeat(180)));
  });

  it("prints an A6 card, in English or in Bangla", async () => {
    for (const note of [
      "Happy birthday, Apu.\nWear it often.",
      "শুভ জন্মদিন, আপু।",
      "Happy birthday আপু",
    ]) {
      const pdf = Buffer.from(await renderGiftCard(note, "ZLF-001042"));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toMatch(/\/MediaBox \[0 0 297\.\d+ 419\.\d+\]/);
    }
  }, 30_000);
});
