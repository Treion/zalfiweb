import { expect, test } from "@playwright/test";
import { E2E } from "./db";
import { overflow, signIn } from "./helpers";

/**
 * The main admin pages in light and dark, on a desktop and a phone, saved as test artifacts
 * (test-results/screens). On a phone, no page may be wider than the screen: wide tables scroll
 * inside their own box.
 */
const PAGES = [
  ["overview", "/admin"],
  ["orders", "/admin/orders"],
  ["products", "/admin/products"],
  ["notes", "/admin/notes"],
  ["content", "/admin/content"],
  ["content-videos", "/admin/content?tab=videos"],
  ["reviews", "/admin/reviews"],
  ["inventory", "/admin/inventory"],
  ["payments", "/admin/payments"],
  ["shipping", "/admin/shipping"],
  ["customers", "/admin/customers"],
  ["reports", "/admin/reports"],
  ["integrations", "/admin/integrations"],
  ["settings", "/admin/settings"],
] as const;

for (const theme of ["light", "dark"] as const)
  for (const [w, h] of [
    [1440, 900],
    [375, 812],
  ] as const)
    test(`admin pages, ${theme}, ${w}px`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        colorScheme: theme,
      });
      const page = await ctx.newPage();
      await signIn(page, E2E.owner);
      await page.evaluate((t) => localStorage.setItem("theme", t), theme);
      const wide: string[] = [];
      for (const [name, path] of PAGES) {
        await page.goto(path, { waitUntil: "networkidle" });
        await expect(page.locator("main h1").first()).toBeVisible();
        await page.screenshot({
          path: `test-results/screens/${name}-${theme}-${w}.png`,
          fullPage: true,
        });
        if ((await overflow(page)) > 1) wide.push(name);
      }
      // A real order's page too
      await page.goto("/admin/orders", { waitUntil: "networkidle" });
      const href = await page
        .locator('main a[href^="/admin/orders/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      if (href) {
        await page.goto(href, { waitUntil: "networkidle" });
        await page.screenshot({
          path: `test-results/screens/order-${theme}-${w}.png`,
          fullPage: true,
        });
        if ((await overflow(page)) > 1) wide.push("order");
      }
      // And a discovery set's page
      await page.goto("/admin/products", { waitUntil: "networkidle" });
      const set = await page
        .locator('#sets table a[href^="/admin/products/sets/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      if (set) {
        await page.goto(set, { waitUntil: "networkidle" });
        await expect(page.getByText("In the box", { exact: true })).toBeVisible();
        await page.screenshot({
          path: `test-results/screens/set-${theme}-${w}.png`,
          fullPage: true,
        });
        if ((await overflow(page)) > 1) wide.push("set");
      }
      expect(wide, "pages wider than the screen").toEqual([]);
      await ctx.close();
    });
