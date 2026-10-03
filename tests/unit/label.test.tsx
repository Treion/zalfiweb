import { describe, expect, it } from "vitest";
import { renderLabels, type LabelData } from "@/server/shipping/label";

const label = (number: string, cod: number): LabelData => ({
  number,
  date: "3 Oct 2026",
  courier: "Steadfast",
  consignmentId: "1424107",
  trackingCode: "15BAEB8A",
  cod,
  name: "Nusrat Jahan",
  phone: "01712-345678",
  address: ["Road 7A, House 21", "Dhanmondi, Dhaka"],
  zone: "Inside Dhaka",
  items: "Reva ×2, Oudor",
  bottles: 3,
  from: { phone: "+880 1810-524672", address: "Kakrail, Dhaka 1214" },
});

describe("shipping labels", () => {
  it("render one 4 × 6 inch page per order", async () => {
    const pdf = Buffer.from(
      await renderLabels([label("ZLF-001234", 457_000), label("ZLF-001235", 0)]),
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const text = pdf.toString("latin1");
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(2);
    expect(text).toContain("/MediaBox [0 0 288 432]");
  });
});
