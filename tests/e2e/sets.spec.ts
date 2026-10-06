import { expect, test } from "@playwright/test";
import { E2E, orderByNumber, stockOf } from "./db";
import { checkout, openOrder, orderNumber, signIn } from "./helpers";

/**
 * A discovery set, bought like a bottle: added from the Discovery page, checked out with cash on
 * delivery, and sold from the set's own boxes. The bottles' stock never moves.
 */
test("buys a discovery set from its page; the set's boxes go down, the bottles don't", async ({
  page,
  browser,
}) => {
  const [setBefore, bottleBefore] = [await stockOf(E2E.set.sku), await stockOf()];

  await page.goto("/discovery");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Three vials.");
  await page.getByRole("button", { name: `Add the set: ${E2E.set.name}` }).click();
  const bag = page.getByRole("dialog", { name: /Your bag/ });
  await expect(bag.getByText("Discovery set · 3 × 3 ml")).toBeVisible();
  await bag.getByRole("button", { name: "Close" }).click();

  await checkout(page, "Cash on delivery", { keepBag: true });
  const number = await orderNumber(page);
  await expect(page.getByText("3 × 3 ml × 1")).toBeVisible();
  expect(await orderByNumber(number)).toMatchObject({ status: "confirmed" });

  const setAfter = await stockOf(E2E.set.sku);
  expect(setAfter.stock).toBe(setBefore.stock - 1);
  expect(setAfter.stock).toBe(setAfter.ledger);
  expect((await stockOf()).stock).toBe(bottleBefore.stock);

  // The team sees it as a set, everywhere
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  await openOrder(a, number);
  await expect(a.getByText(E2E.set.name).first()).toBeVisible();
  await expect(a.getByText("3 × 3 ml").first()).toBeVisible();

  await a.goto("/admin/products");
  const sets = a.locator("#sets");
  await expect(sets.getByText("Discovery sets")).toBeVisible();
  await sets.getByRole("link", { name: E2E.set.name }).click();
  await a.waitForURL(/\/admin\/products\/sets\/\d+/);
  await expect(a.getByText("In the box", { exact: true })).toBeVisible();
  await expect(a.getByText("Pack and price")).toBeVisible();

  await a.goto("/admin/inventory");
  await expect(a.getByText(E2E.set.sku)).toBeVisible();
  await ctx.close();
});
