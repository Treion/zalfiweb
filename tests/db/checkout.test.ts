import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminUsers,
  coupons,
  customers,
  fragrances,
  orderEvents,
  orders,
  settings,
  stockMovements,
  stockReservations,
  variants,
} from "@/db/schema";
import { placeOrderSchema, type PlaceOrderInput } from "@/lib/checkout";
import { adjustStock } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { expireUnpaidOrders, moveOrders, transitionOrder } from "@/server/orders/manage";
import { TotalChanged, placeOrder } from "@/server/orders/place";
import { sendCode, verifiedPhone, verifyCode } from "@/server/checkout/otp";
import { phoneOtps, phoneVerifications } from "@/db/schema";

/**
 * Checkout against a real database: a throwaway published fragrance, a test coupon, test phones.
 * Cash on delivery is switched on for the run and the payments settings are restored afterwards.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-checkout-${RUN}`;
const SKU = `ZZ-${RUN.toUpperCase()}-50`;
const CODE = `ZZ${RUN.toUpperCase()}`;
const phone = (n: number) =>
  `0199${String(Date.now() % 1_000_000).padStart(6, "0")}${n}`.slice(0, 11);
const admin = { id: `zz-admin-${RUN}`, email: `zz-admin-${RUN}@zalfi.test` };
let variantId = 0;
const saved = new Map<string, unknown>();

const stockOf = async () =>
  (
    await poolDb().select({ s: variants.stock }).from(variants).where(eq(variants.id, variantId))
  )[0]!.s;
const ledgerOf = async () =>
  Number(
    (
      await poolDb()
        .select({ s: sql<number>`coalesce(sum(${stockMovements.delta}),0)::int` })
        .from(stockMovements)
        .where(eq(stockMovements.variantId, variantId))
    )[0]!.s,
  );
const setStock = async (n: number) => {
  const delta = n - (await stockOf());
  if (delta) await withTx((tx) => adjustStock(tx, { variantId, delta, type: "manual_adjustment" }));
};

async function order(p: string, over: Partial<PlaceOrderInput> = {}) {
  const items = over.items ?? [{ sku: SKU, qty: 1 }];
  const q = await quoteBag(
    { items, district: "Dhaka", area: "Dhanmondi", coupon: over.coupon?.toString() },
    p,
  );
  return placeOrderSchema.parse({
    name: "Test Buyer",
    phone: p,
    email: "buyer@example.com",
    district: "Dhaka",
    area: "Dhanmondi",
    street: "House 1, Road 1",
    items,
    paymentMethod: "cod",
    expectedTotal: q.total,
    idempotencyKey: `${SLUG}-${Math.random().toString(36).slice(2)}`,
    ...over,
  });
}
const idOf = async (number: string) =>
  (await poolDb().select({ id: orders.id }).from(orders).where(eq(orders.number, number)))[0]!.id;

beforeAll(async () => {
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Test",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: true,
      sortOrder: 999,
    })
    .returning({ id: fragrances.id });
  const [v] = await poolDb()
    .insert(variants)
    .values({ fragranceId: f!.id, sku: SKU, sizeMl: 50, pricePoisha: 100_000, stock: 0 })
    .returning({ id: variants.id });
  variantId = v!.id;
  await withTx((tx) => adjustStock(tx, { variantId, delta: 5, type: "initial" }));
  await poolDb().insert(coupons).values({ code: CODE, percentOff: 10, usageLimit: 1 });

  // Pin the settings this test depends on; the owner's are put back afterwards
  const pinned = {
    payments: { sslcommerzEnabled: true, codEnabled: true, unpaidExpiryMinutes: 30 },
    shipping: {},
  };
  for (const [key, value] of Object.entries(pinned)) {
    const [row] = await poolDb().select().from(settings).where(eq(settings.key, key));
    saved.set(key, row?.value);
    await poolDb()
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }
});

afterAll(async () => {
  // Let background receipts finish before the rows go
  await new Promise((r) => setTimeout(r, 2500));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.email, "buyer@example.com"));
  await poolDb().delete(coupons).where(eq(coupons.code, CODE));
  await poolDb().delete(fragrances).where(eq(fragrances.slug, SLUG));
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
  for (const [key, value] of saved)
    if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, key));
    else await poolDb().update(settings).set({ value }).where(eq(settings.key, key));
});

describe("checkout", () => {
  it("places a cash-on-delivery order: confirmed, stock sold, and a repeat changes nothing", async () => {
    const p = phone(1);
    const input = await order(p);
    const placed = await placeOrder(input, p);
    expect(placed.status).toBe("confirmed");
    expect(placed.number).toMatch(/^ZLF-\d{6}$/);
    expect(await stockOf()).toBe(4);

    const again = await placeOrder(input, p);
    expect(again.number).toBe(placed.number);
    expect(await stockOf()).toBe(4);

    const [o] = await poolDb().select().from(orders).where(eq(orders.number, placed.number));
    expect(o).toMatchObject({
      subtotal: 100_000,
      shippingFee: 7_000,
      total: 107_000,
      zone: "inside_dhaka",
    });
    const [c] = await poolDb().select().from(customers).where(eq(customers.phone, p));
    expect(c?.name).toBe("Test Buyer");
    const events = await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, o!.id));
    expect(events.some((e) => e.type === "placed")).toBe(true);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("returns one order when the same checkout is submitted twice at once", async () => {
    const p = phone(1);
    const input = await order(p);
    const before = await stockOf();
    const [a, b] = await Promise.all([placeOrder(input, p), placeOrder(input, p)]);
    expect(a.number).toBe(b.number);
    expect(await stockOf()).toBe(before - 1);
  });

  it("refuses an unverified phone and a changed total", async () => {
    const p = phone(2);
    const input = await order(p);
    await expect(placeOrder(input, null)).rejects.toThrow(/Verify your phone/);
    await expect(placeOrder({ ...input, expectedTotal: 1 }, p)).rejects.toBeInstanceOf(
      TotalChanged,
    );
  });

  it("holds stock for an online order, and releases it when the order expires", async () => {
    const p = phone(3);
    const placed = await placeOrder(await order(p, { paymentMethod: "sslcommerz" }), p);
    expect(placed.status).toBe("pending_payment");
    const id = await idOf(placed.number);
    const before = await stockOf();
    const held = await poolDb()
      .select()
      .from(stockReservations)
      .where(eq(stockReservations.orderId, id));
    expect(held.map((h) => h.qty)).toEqual([1]);

    await poolDb()
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.id, id));
    expect(await expireUnpaidOrders()).toBeGreaterThanOrEqual(1);
    const [o] = await poolDb().select().from(orders).where(eq(orders.id, id));
    expect(o?.status).toBe("cancelled");
    const [r] = await poolDb()
      .select()
      .from(stockReservations)
      .where(eq(stockReservations.orderId, id));
    expect(r?.releasedAt).not.toBeNull();
    expect(await stockOf()).toBe(before);
  });

  it("sells the last bottle to only one of two simultaneous checkouts", async () => {
    await setStock(1);
    const [a, b] = [phone(4), phone(5)];
    const [ia, ib] = [await order(a), await order(b)];
    const results = await Promise.allSettled([placeOrder(ia, a), placeOrder(ib, b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(lost.reason.message)).toMatch(/sold out|left/);
    expect(await stockOf()).toBe(0);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("gives a single-use coupon to only one of two simultaneous orders", async () => {
    await setStock(5);
    const [a, b] = [phone(6), phone(7)];
    const [ia, ib] = [await order(a, { coupon: CODE }), await order(b, { coupon: CODE })];
    expect(ia.expectedTotal).toBe(97_000);
    const results = await Promise.allSettled([placeOrder(ia, a), placeOrder(ib, b)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const lost = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(lost.reason.message)).toMatch(/fully used/);
  });

  it("moves along the state machine, and a cancellation can restock", async () => {
    await setStock(3);
    const p = phone(8);
    const placed = await placeOrder(await order(p, { items: [{ sku: SKU, qty: 2 }] }), p);
    const id = await idOf(placed.number);
    expect(await stockOf()).toBe(1);
    await expect(moveOrders([id], "delivered", admin)).rejects.toThrow(/can't become delivered/);
    await moveOrders([id], "packed", admin);
    await moveOrders([id], "cancelled", admin, { restock: true, note: "Customer asked." });
    expect(await stockOf()).toBe(3);
    await expect(
      withTx((tx) => transitionOrder(tx, id, "packed", { actor: "system" })),
    ).rejects.toThrow();
    const types = (
      await poolDb()
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, id))
        .orderBy(asc(orderEvents.id))
    )
      .map((e) => e.toStatus)
      .filter(Boolean);
    expect(types).toEqual(["confirmed", "packed", "cancelled"]);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("marks a cash-on-delivery order paid when it is delivered", async () => {
    const p = phone(9);
    const placed = await placeOrder(await order(p), p);
    const id = await idOf(placed.number);
    for (const s of ["packed", "shipped", "delivered"] as const) await moveOrders([id], s, admin);
    const [o] = await poolDb().select().from(orders).where(eq(orders.id, id));
    expect(o).toMatchObject({ status: "delivered", paymentStatus: "paid" });
    expect(o?.deliveredAt).not.toBeNull();
  });

  it("verifies a phone by SMS code: wrong codes count, the right one verifies for 24 hours", async () => {
    const p = phone(0);
    const sent = await sendCode(p, null);
    expect(sent.devCode).toMatch(/^\d{6}$/);
    await expect(sendCode(p, null)).rejects.toThrow(/new code in/);
    const wrong = sent.devCode === "000000" ? "111111" : "000000";
    await expect(verifyCode(p, wrong, null)).rejects.toThrow(/4 tries left/);
    const { token, expiresAt } = await verifyCode(p, sent.devCode!, null);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    expect(await verifiedPhone(token)).toBe(p);
    expect(await verifiedPhone("not-a-token")).toBeNull();
    // A used code can't be used again
    await expect(verifyCode(p, sent.devCode!, null)).rejects.toThrow(/expired/);
    await poolDb().delete(phoneOtps).where(eq(phoneOtps.phone, p));
    await poolDb().delete(phoneVerifications).where(eq(phoneVerifications.phone, p));
    await poolDb().execute(sql`delete from rate_limits where key like ${`otp-%${p}%`}`);
  });
});
