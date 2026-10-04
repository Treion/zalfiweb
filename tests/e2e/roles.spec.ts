import { expect, test } from "@playwright/test";
import { E2E } from "./db";
import { signIn } from "./helpers";

test("a manager can't open the owner's pages, isn't shown them, and can only look at Integrations", async ({
  page,
}) => {
  await signIn(page, E2E.manager);
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Activity log" })).toHaveCount(0);
  for (const path of ["/admin/team", "/admin/activity"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(403);
  }
  // Integrations: the set-up is visible, the keys and switches are the owner's
  await page.goto("/admin/integrations");
  await expect(page.getByText("Only the owner can change them.")).toBeVisible();
  await expect(page.getByRole("switch", { name: /on or off/ }).first()).toBeDisabled();
  // The owner's exports are refused at the door too, not only hidden
  const csv = await page.request.get("/api/admin/export/audit");
  expect(csv.status()).toBe(403);
});

test("the admin is closed to anyone signed out", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
  const res = await page.request.get("/api/admin/export/orders");
  expect(res.status()).toBe(401);
});
