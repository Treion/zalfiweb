import { expect, test } from "@playwright/test";
import { E2E, orderByNumber } from "./db";
import { checkout, openOrder, orderNumber, signIn } from "./helpers";

/**
 * After the order: a gift with its note (on the customer's page, the admin's order page and the
 * printable card), and finding an order again from /track.
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
