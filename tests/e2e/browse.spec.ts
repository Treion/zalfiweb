import { expect, test } from "@playwright/test";
import { E2E } from "./db";
import { signIn } from "./helpers";

/**
 * Finding and choosing on a phone: the Menu, All fragrances with its filters, one-tap Add. And the
 * delivery times the team sets in Settings, as the product page shows them.
 */

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("opens the menu, filters all fragrances and adds one to the bag", async ({ page }) => {
    await page.goto("/discovery");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("region", { name: "Menu" });
    await expect(menu.getByRole("link", { name: "All fragrances" })).toBeFocused();
    await menu.getByRole("link", { name: "All fragrances" }).click();
    await page.waitForURL("**/fragrances");
    await expect(menu).toHaveCount(0);

    const filters = page.getByRole("region", { name: "Filters" });
    const list = page
      .locator("main ul")
      .filter({ has: page.getByRole("button", { name: /^Add / }) });
    const all = await list.locator("> li").count();
    await filters
      .getByRole("group", { name: "Wear it" })
      .getByRole("button", { name: "Evening" })
      .click();
    await expect(page).toHaveURL(/wear=evening/);
    const some = await list.locator("> li").count();
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThanOrEqual(all);
    await expect(filters.getByRole("button", { name: "Clear" })).toBeVisible();

    // The address keeps the choice: reloading shows the same list
    await page.reload();
    await expect(list.locator("> li")).toHaveCount(some);

    const add = list.getByRole("button", { name: /^Add / }).first();
    const name = (await add.getAttribute("aria-label"))!.replace(/^Add | to bag$/g, "");
    await add.click();
    // The bag opens with it
    await expect(page.getByRole("dialog", { name: /Your bag/ }).getByText(name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Bag, 1 item" })).toBeAttached();
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).resolves.toBe(0);
  });
});

test("shows the delivery times set in Settings on the product page", async ({ page, browser }) => {
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  await a.goto("/admin/settings");
  await a.getByRole("tab", { name: "Shipping" }).click();
  await a.getByLabel("Delivery inside Dhaka (days)").fill("2–3");
  await a.getByLabel("Delivery outside Dhaka (days)").fill("");
  await a.getByRole("tabpanel").getByRole("button", { name: "Save" }).click();
  await expect(a.getByText("Saved")).toBeVisible();
  await ctx.close();

  await page.goto(`/fragrances/${E2E.slug}`);
  const inside = page.locator("dl div", { hasText: "Inside Dhaka" });
  await expect(inside).toContainText("usually 2–3 days");
  // Left empty: the time isn't promised
  await expect(page.locator("dl div", { hasText: "Outside Dhaka" })).not.toContainText("usually");
});
