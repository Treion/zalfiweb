import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { customers, fragrances, orders, restockRequests, settings, variants } from "@/db/schema";
import { placeOrderSchema } from "@/lib/checkout";
import { notifyRestocked, requestRestock, waitingByVariant } from "@/server/catalog/restock";
import { adjustStock } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { loadInvoice } from "@/server/invoice/data";
import { placeOrder } from "@/server/orders/place";
import { findOrderPage } from "@/server/orders/track";
import { isolateIntegrations } from "./isolate";

/**
 * After the order: "Notify me" for a sold-out size, "Track your order", and the free gift note.
 * A throwaway fragrance, sold out to begin with; texts go to the dev SMS log (no gateway is on).
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-after-${RUN}`;
const SKU = `ZZ-AFTER-${RUN.toUpperCase()}`;
const phone = `0197${String(Date.now() % 10_000_000).padStart(7, "0")}`;
const other = `0196${String(Date.now() % 10_000_000).padStart(7, "0")}`;
const integrationsTable = isolateIntegrations();
const saved = new Map<string, unknown>();
let fragranceId = 0;
let variantId = 0;

const smsLog = () => readFile(path.join(process.cwd(), ".data/sms.log"), "utf8").catch(() => "");
const waiting = async () =>
  poolDb()
    .select()
    .from(restockRequests)
    .where(and(eq(restockRequests.variantId, variantId), isNull(restockRequests.notifiedAt)));

beforeAll(async () => {
  await integrationsTable.save();
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Back",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: true,
      sortOrder: 980,
    })
    .returning({ id: fragrances.id });
  fragranceId = f!.id;
  const [v] = await poolDb()
    .insert(variants)
    .values({ fragranceId, sku: SKU, sizeMl: 50, pricePoisha: 450_000, stock: 0 })
    .returning({ id: variants.id });
  variantId = v!.id;

  const value = { sslcommerzEnabled: true, codEnabled: true, unpaidExpiryMinutes: 30 };
  const [row] = await poolDb().select().from(settings).where(eq(settings.key, "payments"));
  saved.set("payments", row?.value);
  await poolDb()
    .insert(settings)
    .values({ key: "payments", value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.phone, phone));
  await poolDb().delete(fragrances).where(eq(fragrances.id, fragranceId));
  const value = saved.get("payments");
  if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, "payments"));
  else await poolDb().update(settings).set({ value }).where(eq(settings.key, "payments"));
  await integrationsTable.restore();
});

describe("back-in-stock texts", () => {
  it("keeps one request per phone and size while it's sold out", async () => {
    expect(await requestRestock(SKU, phone)).toEqual({ status: "waiting" });
    expect(await requestRestock(SKU, phone)).toEqual({ status: "waiting" });
    expect(await requestRestock(SKU, other)).toEqual({ status: "waiting" });
    expect(await waiting()).toHaveLength(2);
    expect((await waitingByVariant([variantId])).get(variantId)).toBe(2);
    await expect(requestRestock("ZZ-NOPE", phone)).rejects.toThrow("isn't on sale");
  });

  it("sends nothing for a change that's rolled back", async () => {
    await expect(
      withTx(async (tx) => {
        await adjustStock(tx, { variantId, delta: 2, type: "manual_adjustment" });
        throw new Error("undo");
      }),
    ).rejects.toThrow("undo");
    expect(await notifyRestocked(variantId)).toBe(0);
    expect(await waiting()).toHaveLength(2);
  });

  it("texts everyone waiting once, when stock comes back", async () => {
    await withTx((tx) => adjustStock(tx, { variantId, delta: 3, type: "manual_adjustment" }));
    // The text goes out in the background, after the stock change commits
    for (let i = 0; i < 50 && (await waiting()).length; i++)
      await new Promise((r) => setTimeout(r, 100));
    expect(await waiting()).toHaveLength(0);
    const log = await smsLog();
    expect(log).toContain(`${phone} "ZALFI: Zz Back is back.`);
    expect(log).toContain(`/fragrances/${SLUG}`);
    // Nobody is left to text
    expect(await notifyRestocked(variantId)).toBe(0);
    // In stock now: nothing to wait for
    expect(await requestRestock(SKU, phone)).toEqual({ status: "in_stock" });
  });
});

describe("track your order, and the gift note", () => {
  let number = "";

  it("keeps the gift note with the order, and on the receipt", async () => {
    const items = [{ sku: SKU, qty: 1 }];
    const q = await quoteBag({ items, district: "Dhaka", area: "Dhanmondi" }, phone);
    const placed = await placeOrder(
      placeOrderSchema.parse({
        name: "Gift Buyer",
        phone,
        email: "gift-buyer@example.com",
        district: "Dhaka",
        area: "Dhanmondi",
        street: "House 1, Road 1",
        items,
        paymentMethod: "cod",
        giftMessage: "  Happy birthday, Apu.\nWear it often.  ",
        expectedTotal: q.total,
        idempotencyKey: `${SLUG}-gift`,
      }),
      phone,
    );
    number = placed.number;
    const [o] = await poolDb().select().from(orders).where(eq(orders.number, number));
    expect(o!.giftMessage).toBe("Happy birthday, Apu.\nWear it often.");
    expect((await loadInvoice(o!.id))!.data.giftMessage).toBe(o!.giftMessage);
  });

  it("opens the order page for the right number and phone, in any spelling", async () => {
    const [o] = await poolDb().select().from(orders).where(eq(orders.number, number));
    const page = `/checkout/thanks?o=${o!.accessToken}`;
    const digits = number.replace(/\D/g, "");
    expect(await findOrderPage(number, phone)).toBe(page);
    expect(await findOrderPage(number.toLowerCase(), phone)).toBe(page);
    expect(await findOrderPage(String(Number(digits)), phone)).toBe(page);
  });

  it("finds nothing when either part is wrong", async () => {
    expect(await findOrderPage(number, other)).toBeNull();
    expect(await findOrderPage("ZLF-999999", phone)).toBeNull();
    expect(await findOrderPage("not a number", phone)).toBeNull();
  });
});
