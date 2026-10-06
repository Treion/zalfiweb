import { expect, test } from "@playwright/test";
import { E2E, orderByNumber } from "./db";
import { checkout, openOrder, orderNumber, shipAndDeliver, signIn } from "./helpers";

/**
 * After the order: a gift with its note (on the customer's page, the admin's order page and the
 * printable card), finding an order again from /track, and a review from a delivered order's page
 * that reaches the shop once the team approves it.
 */
const NOTE = "Happy birthday, Apu.\nWear it often.";

test("sends an order as a gift, and the team can print its note", async ({ page, browser }) => {
  const c = await checkout(page, "Cash on delivery", { gift: NOTE });
  const number = await orderNumber(page);
  await expect(page.getByText("A gift · your note goes in the box")).toBeVisible();
  await expect(page.getByText("Happy birthday, Apu.")).toBeVisible();
  expect((await orderByNumber(number))?.gift_message).toBe(NOTE);

  // Found again from /track, with the number as it's often typed and the phone it was placed with
  await page.goto("/track");
  await page.getByLabel("Order number").fill(number.replace("ZLF-", "zlf "));
  await page.getByLabel("Mobile number you ordered with").fill("01700000000");
  await page.getByRole("button", { name: "Find my order" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "We couldn't find that order",
  );
  await page.getByLabel("Mobile number you ordered with").fill(c.phone);
  await page.getByRole("button", { name: "Find my order" }).click();
  await page.waitForURL("**/checkout/thanks**");
  await expect(page.getByText(`Order ${number}`)).toBeVisible();

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  await openOrder(a, number);
  await expect(a.getByText("A gift", { exact: true })).toBeVisible();
  const print = a.getByRole("link", { name: "Print gift card" });
  const pdf = await a.request.get((await print.getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  await ctx.close();
});

test("reviews a delivered order; the review shows once approved", async ({ page, browser }) => {
  await checkout(page, "Cash on delivery");
  const number = await orderNumber(page);
  const orderPage = page.url();
  // Not delivered yet: nothing to review
  await expect(page.getByRole("heading", { name: "Review your fragrances" })).toHaveCount(0);

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  await shipAndDeliver(a, number);

  await page.goto(orderPage);
  await expect(page.getByText("It’s with you,")).toBeVisible();
  const section = page.locator("#review");
  await expect(section.getByRole("heading", { name: "Review your fragrances" })).toBeVisible();
  await section.getByRole("button", { name: "Send review" }).click();
  await expect(section.getByRole("alert")).toHaveText("Choose a rating.");
  await section.getByLabel(`4 out of 5 for ${E2E.name}`).check({ force: true });
  await section.getByLabel("How does it wear?").fill("Soft at first, then warm all evening.");
  await section.getByRole("button", { name: "Send review" }).click();
  await expect(section.getByText("We read every review before it shows.")).toBeVisible();

  // The team reads it, approves it and replies
  await a.goto("/admin/reviews");
  const card = a.locator("li", { hasText: "Soft at first, then warm all evening." });
  await expect(card.getByText(number)).toBeVisible();
  await card.getByRole("button", { name: "Reply" }).click();
  await card.getByRole("textbox").fill("Thank you. Wear it well.");
  await card.getByRole("button", { name: "Save reply" }).click();
  await expect(card.getByText("Your reply")).toBeVisible();
  await card.getByRole("button", { name: "Approve" }).click();
  // Read: it leaves the "To read" list
  await expect(card).toHaveCount(0);
  await ctx.close();

  await page.goto(`/fragrances/${E2E.slug}`);
  const reviews = page.locator("#reviews");
  await expect(reviews.getByText("Soft at first, then warm all evening.")).toBeVisible();
  await expect(reviews.getByText("Thank you. Wear it well.")).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(ld!).aggregateRating).toMatchObject({ "@type": "AggregateRating" });
});
