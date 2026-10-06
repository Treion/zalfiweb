import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { E2E, withDb } from "./db";
import { signIn } from "./helpers";

/**
 * Admin → Content, in the browser: the owner adds banners for the top of the shop (a wide and a
 * phone picture, words and a link) and a YouTube video, and the shop shows them. Everything made
 * here is named "Zz e2e…" and removed afterwards (KEEP_CONTENT=1 keeps it, for screenshots).
 */
const DIR = path.join(process.cwd(), "test-results", "content-fixtures");

/** A campaign-like picture: the Reva bottle on a dusk ground */
async function picture(name: string, width: number, height: number, bg: string) {
  mkdirSync(DIR, { recursive: true });
  const bottleH = Math.round(height * 0.72);
  const bottle = await sharp(path.join(process.cwd(), "public/images/bottles/reva.png"))
    .resize({ height: bottleH })
    .toBuffer();
  const file = path.join(DIR, name);
  await sharp({ create: { width, height, channels: 3, background: bg } })
    .composite([
      {
        input: bottle,
        top: Math.round(height * 0.16),
        left: Math.round(width > height ? width * 0.6 : (width - bottleH) / 2),
      },
    ])
    .jpeg({ quality: 88 })
    .toFile(file);
  return file;
}

async function addBanner(a: Page, alt: string, file: string) {
  const shop = a.locator("section", { has: a.getByRole("heading", { name: "Top of the shop" }) });
  await shop.getByRole("button", { name: "Add a banner" }).click();
  const dialog = a.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await dialog.getByLabel("What it shows").fill(alt);
  await dialog.getByRole("button", { name: "Add banner" }).click();
  await expect(a.getByText("Banner added.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
}

test.afterAll(async () => {
  if (process.env.KEEP_CONTENT) return;
  await withDb(async (db) => {
    await db.query(`delete from banners where alt like 'Zz e2e%'`);
    await db.query(`delete from videos where title like 'Zz e2e%'`);
  });
});

test("banners and a video added in the admin appear on the shop", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await ctx.newPage();
  await signIn(a, E2E.owner);
  await a.goto("/admin/content");

  // The first banner: a wide and a phone picture, words, a button and a link
  await addBanner(a, "Zz e2e: Reva at dusk", await picture("wide.jpg", 2400, 1000, "#2b2340"));
  const card = a.getByRole("group", { name: "Banner: Zz e2e: Reva at dusk" });
  await card.getByLabel("Headline (optional)").fill("Reva, at dusk");
  await card.getByLabel("Line under it (optional)").fill("Cold fruit and wild mint.");
  await card.getByLabel("Button (optional)").fill("Shop Reva");
  await card.getByLabel("Leads to (optional)").fill("/fragrances/reva");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(a.getByText("Saved. The shop is updated.")).toBeVisible();
  await card
    .locator('input[type="file"][aria-label="Add"]')
    .setInputFiles(await picture("phone.jpg", 1080, 1350, "#2b2340"));
  await expect(a.getByText("Phone picture saved")).toBeVisible();

  // A second one, with its words in the picture
  await addBanner(a, "Zz e2e: Oudor in smoke", await picture("wide2.jpg", 2400, 1000, "#3a1d22"));

  // A video about Reva
  await a.getByRole("tab", { name: "Videos" }).click();
  await a.getByLabel("YouTube link").first().fill("https://youtu.be/dQw4w9WgXcQ");
  await a.getByLabel("Title").first().fill("Zz e2e: Reva, worn for a week");
  await a.getByRole("button", { name: "Add video" }).click();
  await expect(a.getByText("Video added")).toBeVisible();
  await ctx.close();

  // The shop, on a computer
  const shopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await shopCtx.newPage();
  await page.goto("/fragrances");
  const carousel = page.getByRole("region", { name: "From the house" });
  const first = carousel.getByRole("link", { name: "Reva, at dusk" });
  await expect(first).toBeVisible();
  await expect(first).toHaveAttribute("href", "/fragrances/reva");
  await expect(carousel.getByText("Shop Reva")).toBeVisible();
  // Two banners: they move only when asked
  await page.waitForTimeout(1500);
  await expect(first).toBeVisible();
  await carousel.getByRole("button", { name: "Next banner" }).click();
  await expect(carousel.getByRole("button", { name: "Banner 2 of 2" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(carousel.getByRole("img", { name: "Zz e2e: Oudor in smoke" })).toBeVisible();
  // The video: a still cover until it's played
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Play: Zz e2e: Reva, worn for a week" }).click();
  await expect(page.locator('iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toHaveCount(
    1,
  );
  await shopCtx.close();

  // On a phone, the phone picture
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const p = await phone.newPage();
  await p.goto("/fragrances");
  await expect(p.locator('picture source[media="(max-width: 767.98px)"]').first()).toHaveAttribute(
    "srcset",
    /content%2Fbanner|content\/banner/,
  );
  await expect(p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).resolves.toBe(
    0,
  );
  await phone.close();
});
