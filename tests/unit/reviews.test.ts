import { describe, expect, it } from "vitest";
import { averageOf, ratingLabel, reviewInputSchema, signatureOf } from "@/lib/reviews";
import { renderReviewAsk } from "@/server/reviews/email";

const valid = {
  token: "a".repeat(32),
  itemId: 12,
  rating: 4,
  body: "Lasts all day.",
  name: "Nusrat J.",
};

describe("reviews", () => {
  it("signs a review with the first name and an initial", () => {
    expect(signatureOf("Nusrat Jahan")).toBe("Nusrat J.");
    expect(signatureOf("  Md Rafiqul   islam ")).toBe("Md I.");
    expect(signatureOf("Rahim")).toBe("Rahim");
    expect(signatureOf("")).toBe("");
  });

  it("averages to one decimal and says it in words", () => {
    expect(averageOf([])).toBe(0);
    expect(averageOf([5, 4, 4])).toBe(4.3);
    expect(ratingLabel(4.3, 3)).toBe("4.3 out of 5, from 3 reviews");
    expect(ratingLabel(5, 1)).toBe("5.0 out of 5, from 1 review");
  });

  it("takes a rating from 1 to 5, a short text and a signature, nothing else", () => {
    expect(reviewInputSchema.safeParse(valid).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, body: "" }).success).toBe(true);
    for (const bad of [
      { rating: 0 },
      { rating: 6 },
      { rating: 4.5 },
      { name: "  " },
      { body: "x".repeat(601) },
      { token: "short" },
      { status: "approved" },
    ])
      expect(reviewInputSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
  });

  it("emails the link to the order's review form", async () => {
    const r = await renderReviewAsk({
      number: "ZLF-001042",
      firstName: "Nusrat",
      items: "Reva and Oudor",
      reviewUrl: "http://localhost:3000/checkout/thanks?o=abc#review",
      siteUrl: "http://localhost:3000",
      store: { phone: "+880 1810-524672", email: "hello@zalfi.com" },
    });
    expect(r.html).toContain("It’s with you, Nusrat.");
    expect(r.html).toContain("/checkout/thanks?o=abc#review");
    expect(r.text).toContain("Reva and Oudor");
  });
});
