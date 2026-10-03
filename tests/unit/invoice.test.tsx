import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { InvoiceData } from "@/server/invoice/data";
import { renderReceipt } from "@/server/invoice/email";
import { renderInvoicePdf } from "@/server/invoice/pdf";

const data: InvoiceData = {
  number: "ZLF-001042",
  date: "3 Oct 2026",
  store: {
    name: "ZALFI",
    phone: "+880 1700-000000",
    email: "hello@zalfi.com",
    address: "Gulshan 2, Dhaka",
    url: "http://localhost:3000",
  },
  business: [
    { label: "Trade licence", value: "TRAD/DNCC/012345/2026" },
    { label: "BIN", value: "004567891-0101" },
  ],
  businessName: "ZALFI Fragrances",
  businessAddress: "House 12, Road 45, Gulshan 2, Dhaka 1212",
  customer: { name: "Nusrat Jahan", phone: "01712-345678", email: "nusrat@example.com" },
  address: ["বাড়ি ১২, রোড ৫, ধানমন্ডি", "Dhanmondi, Dhaka", "Inside Dhaka"],
  items: [
    { name: "Reva", size: "50 ml", qty: 1, unit: "৳4,500", total: "৳4,500" },
    { name: "Oudor", size: "50 ml", qty: 2, unit: "৳5,200", total: "৳10,400" },
  ],
  totals: [
    { label: "Subtotal", value: "৳14,900" },
    { label: "Discount (WELCOME10)", value: "−৳1,490" },
    { label: "Shipping (Inside Dhaka)", value: "৳70" },
    { label: "Total", value: "৳13,480", strong: true },
    { label: "Includes VAT (15%)", value: "৳1,758.26" },
  ],
  payment: { method: "Cash on delivery", status: "Pay on delivery" },
  trackingUrl: null,
  footerNote: "Thank you for choosing ZALFI.",
};

// INVOICE_PREVIEW_DIR=/some/dir npm test  writes the rendered files there, to look at them
const preview = process.env.INVOICE_PREVIEW_DIR;

describe("invoice", () => {
  it("renders the e-receipt with every line, total and the address", async () => {
    const r = await renderReceipt(data);
    expect(r.subject).toContain("ZLF-001042");
    for (const s of [
      "Reva",
      "Oudor",
      "৳13,480",
      "WELCOME10",
      "Dhanmondi, Dhaka",
      "Pay on delivery",
    ])
      expect(r.html).toContain(s);
    expect(r.text).toContain("৳13,480");
    if (preview) writeFileSync(path.join(preview, "receipt.html"), r.html);
  });

  it("renders the PDF invoice", async () => {
    const pdf = await renderInvoicePdf(data);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
    if (preview) writeFileSync(path.join(preview, "invoice.pdf"), pdf);
  }, 30_000);
});
