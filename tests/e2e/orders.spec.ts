import { expect, test, type Page } from "@playwright/test";
import { E2E, orderByNumber, stockOf } from "./db";
import { checkout, openOrder, orderNumber, receiptFor, signIn } from "./helpers";

/**
 * An order's whole life, in the browser, with the test gateway and the test courier: the customer
 * checks out with a phone code and pays (or doesn't), the team packs and sends it, the courier
 * delivers it, and the money and bottles end up where they should.
 */

async function admin(page: Page) {
  const ctx = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  return a;
}

/** Packs the order, sends it with the test courier, and plays the courier up to delivered */
async function shipAndDeliver(a: Page, number: string) {
  await openOrder(a, number);
  await a.getByRole("button", { name: "Mark packed" }).click();
  await expect(a.getByText(`${number}: packed`, { exact: true })).toBeVisible();
  await a.getByRole("button", { name: "Send to courier" }).first().click();
  await expect(a.getByRole("dialog").getByText("Test courier")).toBeVisible();
  await a.getByRole("dialog").getByRole("button", { name: /^Send/ }).click();
  await expect(a.getByText(/Sent: consignment/)).toBeVisible();
  await a.getByRole("button", { name: /Courier update/ }).click();
  await a.getByRole("menuitem", { name: "Delivered" }).click();
  await expect(a.getByText("Courier: delivered", { exact: true })).toBeVisible();
}

test("pays online, gets the e-receipt, and is packed, sent and delivered", async ({ page }) => {
  const before = await stockOf();
  await checkout(page, "Pay online");
  // The test gateway stands where SSLCommerz's page will
  await page.waitForURL("**/checkout/pay/mock**");
  await page.getByRole("button", { name: "Pay successfully" }).click();
  const number = await orderNumber(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("on its way");
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  expect(await orderByNumber(number)).toMatchObject({
    status: "confirmed",
    payment_status: "paid",
  });
  expect((await stockOf()).stock).toBe(before.stock - 1);

  // The e-receipt, with its PDF invoice, as the dev email stand-in saved it
  await expect.poll(() => receiptFor(number)?.pdf ?? null, { timeout: 30_000 }).toBeTruthy();

  const a = await admin(page);
  await shipAndDeliver(a, number);
  expect(await orderByNumber(number)).toMatchObject({
    status: "delivered",
    payment_status: "paid",
  });
  const s = await stockOf();
  expect(s.stock).toBe(s.ledger);
});

test("a failed payment charges nothing, sells nothing, and lets the customer try again", async ({
  page,
}) => {
  const before = await stockOf();
  await checkout(page, "Pay online");
  await page.waitForURL("**/checkout/pay/mock**");
  await page.getByRole("button", { name: "Fail the payment" }).click();
  const number = await orderNumber(page);
  await expect(
    page.getByText(/The payment didn.t go through, and nothing was charged/),
  ).toBeVisible();
  const o = await orderByNumber(number);
  expect(o.payment_status).not.toBe("paid");
  expect(o.status).toBe("pending_payment");
  // Nothing was sold (the bottle is only held for the retry), and paying again is one tap away
  expect((await stockOf()).stock).toBe(before.stock);
  await expect(page.getByRole("button", { name: /Pay/ }).first()).toBeVisible();
});

test("cash on delivery: confirmed at once, paid when the courier delivers", async ({ page }) => {
  await checkout(page, "Cash on delivery");
  const number = await orderNumber(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("on its way");
  expect(await orderByNumber(number)).toMatchObject({ status: "confirmed" });
  expect((await orderByNumber(number)).payment_status).not.toBe("paid");

  const a = await admin(page);
  await shipAndDeliver(a, number);
  expect(await orderByNumber(number)).toMatchObject({
    status: "delivered",
    payment_status: "paid",
  });
});

test("cancelling an order puts its bottles back, through the ledger", async ({ page }) => {
  await checkout(page, "Cash on delivery");
  const number = await orderNumber(page);
  const sold = await stockOf();

  const a = await admin(page);
  await openOrder(a, number);
  await a.getByRole("button", { name: /More/ }).click();
  await a.getByRole("menuitem", { name: "Cancel order" }).click();
  const dialog = a.getByRole("dialog");
  await expect(dialog.getByText("Put the bottles back in stock")).toBeVisible();
  await dialog.getByLabel("Reason (on the timeline)").fill("The customer changed their mind");
  await dialog.getByRole("button", { name: "Cancel order" }).click();
  await expect(a.getByText(`${number}: cancelled`, { exact: true })).toBeVisible();

  expect((await orderByNumber(number)).status).toBe("cancelled");
  const after = await stockOf();
  expect(after.stock).toBe(sold.stock + 1);
  expect(after.stock).toBe(after.ledger);
});

test("refunds a paid order in full, and its payment status follows", async ({ page }) => {
  await checkout(page, "Pay online");
  await page.waitForURL("**/checkout/pay/mock**");
  await page.getByRole("button", { name: "Pay successfully" }).click();
  const number = await orderNumber(page);

  const a = await admin(page);
  await openOrder(a, number);
  await a.getByRole("button", { name: "Refund" }).click();
  const dialog = a.getByRole("dialog");
  await dialog.getByRole("button", { name: "All" }).click();
  await dialog.getByLabel("Reason (on the timeline)").fill("Bottle arrived damaged");
  await dialog
    .getByRole("button", { name: /Refund/ })
    .last()
    .click();
  await expect(a.getByText(/refunded/)).toBeVisible();
  expect((await orderByNumber(number)).payment_status).toBe("refunded");
});
