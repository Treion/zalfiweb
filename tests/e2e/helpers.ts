import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { E2E } from "./db";

let seq = 0;
/** A fresh phone and email per checkout, so no rate limit or saved customer gets in the way */
export function customer() {
  const n = `${Date.now() % 1_000_000}${seq++}`.padStart(7, "0").slice(-7);
  return { phone: `0177${n}`, email: `zz-e2e+${n}@${E2E.emailDomain}`, name: "Nusrat Jahan" };
}

export async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.fill("#email", who.email);
  await page.fill("#password", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/admin\/?$/);
}

/** The test bottle, straight into the bag (the bag lives in localStorage) */
export async function fillBag(page: Page, qty = 1) {
  await page.goto("/checkout");
  await page.evaluate(
    ({ sku, slug, name, qty }) =>
      localStorage.setItem(
        "zalfi.bag.v2",
        JSON.stringify([
          {
            sku,
            slug,
            name,
            sizeMl: 50,
            pricePoisha: 300000,
            bottleImage: "/images/bottles/bond.png",
            qty,
          },
        ]),
      ),
    { sku: E2E.sku, slug: E2E.slug, name: E2E.name, qty },
  );
  await page.reload();
}

export type Method = "Pay online" | "Cash on delivery";

/** Fills the checkout as a customer would, verifying the phone with the dev SMS code. `keepBag`:
 *  check out what's already in the bag instead of the test bottle; `gift`: send it as a gift, with
 *  this note. */
export async function checkout(
  page: Page,
  method: Method,
  { keepBag = false, gift }: { keepBag?: boolean; gift?: string } = {},
) {
  const c = customer();
  if (keepBag) await page.goto("/checkout");
  else await fillBag(page);
  await page.getByLabel("Full name").fill(c.name);
  await page.getByLabel("Mobile number").fill(c.phone);
  await page.getByRole("button", { name: "Send code" }).click();
  const hint = page.getByText(/Development: the code is \d{6}/);
  await expect(hint).toBeVisible();
  const code = (await hint.textContent())!.match(/(\d{6})/)![1]!;
  await page.getByLabel(/Code sent to/).fill(code);
  await expect(page.getByText("Verified").first()).toBeVisible();
  await page.getByLabel("Email, for your receipt").fill(c.email);
  await page.getByLabel("District").selectOption("Dhaka");
  await page.getByLabel("Area or thana").selectOption("Dhanmondi");
  await page.getByLabel("House, road and street").fill("House 12, Road 5");
  if (gift) {
    await page.getByLabel("This is a gift").check();
    await page.getByLabel("Your note").fill(gift);
  }
  await page.getByLabel(method).check();
  // The total is re-quoted with Dhaka's shipping: place the order once that quote is in
  await expect(page.getByText("Shipping, inside Dhaka")).toBeVisible();
  const place = page.getByRole("button", { name: /Place order/ }).filter({ visible: true });
  await place.click();
  // A quote that still changed under the click is shown, as to a customer: place it again
  const changed = page.getByText("Your total has changed");
  const left = await Promise.race([
    changed.waitFor({ state: "visible", timeout: 8000 }).then(() => "changed" as const),
    page.waitForURL(/\/checkout\/(pay|thanks)/, { timeout: 8000 }).then(() => "left" as const),
  ]).catch(() => "left" as const);
  if (left === "changed") await place.click();
  return c;
}

/** The order number on the confirmation page */
export async function orderNumber(page: Page) {
  await page.waitForURL("**/checkout/thanks**");
  const text = (await page.locator("main .eyebrow").first().textContent()) ?? "";
  return text.replace("Order", "").trim();
}

export async function openOrder(page: Page, number: string) {
  await page.goto(`/admin/orders?q=${encodeURIComponent(number)}`);
  await page.getByRole("link", { name: number }).first().click();
  await page.waitForURL(/\/admin\/orders\/\d+/);
}

/** Packs the order, sends it with the test courier, and plays the courier up to delivered */
export async function shipAndDeliver(a: Page, number: string) {
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

/** The order's status badge, next to its number at the top of the order page */
export const statusOf = (page: Page) => page.locator("main [data-slot=badge]").first();

export function receiptFor(number: string) {
  const outbox = path.join(process.cwd(), ".data", "outbox");
  if (!existsSync(outbox)) return null;
  const files = readdirSync(outbox).filter((f) => f.includes(`receipt-${number}`));
  return {
    json: files.find((f) => f.endsWith(".json")),
    pdf: files.find((f) => f.endsWith(".pdf")),
  };
}

/** Wide content shows up as a page wider than the screen */
export const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
