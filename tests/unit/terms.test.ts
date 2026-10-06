import { describe, expect, it } from "vitest";
import { whatsappUrl } from "@/lib/contact";
import { paymentMarks, toFreeDelivery, usually } from "@/lib/terms";
import { parseSettings } from "@/server/settings/schema";

describe("shop terms", () => {
  it("says only the ways to pay that checkout offers", () => {
    expect(paymentMarks({ online: true, cod: true, wallets: [] })).toEqual([
      "Cards",
      "bKash",
      "Nagad",
      "Cash on delivery",
    ]);
    expect(paymentMarks({ online: false, cod: false, wallets: ["Nagad"] })).toEqual(["Nagad"]);
    expect(paymentMarks({ online: false, cod: false, wallets: [] })).toEqual([]);
  });

  it("words delivery times, and says nothing when the owner leaves them empty", () => {
    expect(usually("1–2")).toBe("usually 1–2 days");
    expect(usually("1")).toBe("usually 1 day");
    expect(usually("")).toBe("");
  });

  it("counts down to free delivery, and stops at zero", () => {
    expect(toFreeDelivery(300_000, 500_000)).toBe(200_000);
    expect(toFreeDelivery(600_000, 500_000)).toBe(0);
    expect(toFreeDelivery(600_000, null)).toBeNull();
  });

  it("has delivery times by default, editable in Settings → Shipping", () => {
    const s = parseSettings("shipping", undefined);
    expect([s.insideDhakaDays, s.outsideDhakaDays]).toEqual(["1–2", "3–5"]);
    expect(parseSettings("shipping", { insideDhakaDays: "" }).insideDhakaDays).toBe("");
  });

  it("opens WhatsApp on the house's number, with an optional first message", () => {
    expect(whatsappUrl()).toBe("https://wa.me/8801810524672");
    expect(whatsappUrl("Hi, about Bond")).toBe(
      "https://wa.me/8801810524672?text=Hi%2C%20about%20Bond",
    );
  });
});
