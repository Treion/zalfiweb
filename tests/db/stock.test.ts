import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fragrances, orders, stockMovements, variants } from "@/db/schema";
import {
  OutOfStock,
  adjustStock,
  commitReservations,
  releaseReservations,
  reserveStock,
  restock,
  sellStock,
} from "@/server/catalog/stock";
import { poolDb, withTx } from "@/server/db/pool";

/**
 * Stock against a real database: a throwaway fragrance with one size, a few orders to hang
 * reservations on, and everything removed afterwards.
 */
const SLUG = `zz-test-${Date.now()}`;
let variantId = 0;
const orderIds: number[] = [];

async function stockOf() {
  const [v] = await poolDb()
    .select({ stock: variants.stock })
    .from(variants)
    .where(eq(variants.id, variantId));
  return v!.stock;
}
async function ledgerOf() {
  const [r] = await poolDb()
    .select({ sum: sql<number>`coalesce(sum(${stockMovements.delta}), 0)::int` })
    .from(stockMovements)
    .where(eq(stockMovements.variantId, variantId));
  return Number(r!.sum);
}
async function newOrder() {
  const [o] = await poolDb()
    .insert(orders)
    .values({
      idempotencyKey: `${SLUG}-${orderIds.length}-${Math.random()}`,
      accessToken: `${SLUG}-${Math.random()}`,
      customerName: "Test",
      customerPhone: "01700000000",
      customerEmail: "test@example.com",
      addressDistrict: "Dhaka",
      addressArea: "Ramna",
      addressStreet: "Test",
      zone: "inside_dhaka",
      paymentMethod: "sslcommerz",
    })
    .returning({ id: orders.id });
  orderIds.push(o!.id);
  return o!.id;
}
const soon = () => new Date(Date.now() + 30 * 60_000);

beforeAll(async () => {
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Test",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: false,
    })
    .returning({ id: fragrances.id });
  const [v] = await poolDb()
    .insert(variants)
    .values({
      fragranceId: f!.id,
      sku: `${SLUG.toUpperCase()}-50`,
      sizeMl: 50,
      pricePoisha: 100_000,
      stock: 0,
    })
    .returning({ id: variants.id });
  variantId = v!.id;
  await withTx((tx) => adjustStock(tx, { variantId, delta: 1, type: "initial", reason: "test" }));
});

afterAll(async () => {
  if (orderIds.length) await poolDb().delete(orders).where(inArray(orders.id, orderIds));
  await poolDb().delete(fragrances).where(eq(fragrances.slug, SLUG));
});

describe("stock ledger and reservations", () => {
  it("only one of two simultaneous checkouts gets the last bottle", async () => {
    const [a, b] = [await newOrder(), await newOrder()];
    const results = await Promise.allSettled([
      withTx((tx) => reserveStock(tx, a, [{ variantId, qty: 1 }], soon())),
      withTx((tx) => reserveStock(tx, b, [{ variantId, qty: 1 }], soon())),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(OutOfStock);
    // Reserving doesn't deduct stock yet
    expect(await stockOf()).toBe(1);
    // Whoever lost the race releases nothing; the winner pays
    const winner = results[0]!.status === "fulfilled" ? a : b;
    const loser = winner === a ? b : a;
    expect(await releaseReservations(poolDb(), loser)).toBe(0);
    expect(await withTx((tx) => commitReservations(tx, winner, "test sale"))).toBe(1);
    expect(await stockOf()).toBe(0);
    // A repeated payment callback changes nothing
    expect(await withTx((tx) => commitReservations(tx, winner, "test sale"))).toBe(0);
    expect(await stockOf()).toBe(0);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("never goes below zero, and manual reductions respect held bottles", async () => {
    await expect(
      withTx((tx) => adjustStock(tx, { variantId, delta: -1, type: "manual_adjustment" })),
    ).rejects.toThrow();
    await withTx((tx) =>
      adjustStock(tx, { variantId, delta: 3, type: "manual_adjustment", reason: "restock" }),
    );
    const held = await newOrder();
    await withTx((tx) => reserveStock(tx, held, [{ variantId, qty: 2 }], soon()));
    await expect(
      withTx((tx) =>
        adjustStock(tx, {
          variantId,
          delta: -2,
          type: "manual_adjustment",
          respectReservations: true,
        }),
      ),
    ).rejects.toThrow(/held for unpaid orders/);
    expect(await releaseReservations(poolDb(), held)).toBe(1);
    await withTx((tx) =>
      adjustStock(tx, {
        variantId,
        delta: -2,
        type: "manual_adjustment",
        respectReservations: true,
      }),
    );
    expect(await stockOf()).toBe(1);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("expired reservations stop holding stock", async () => {
    const o = await newOrder();
    await withTx((tx) => reserveStock(tx, o, [{ variantId, qty: 1 }], new Date(Date.now() - 1000)));
    // The lapsed hold doesn't block another buyer
    const other = await newOrder();
    await expect(
      withTx((tx) => reserveStock(tx, other, [{ variantId, qty: 1 }], soon())),
    ).resolves.toBeUndefined();
    await releaseReservations(poolDb(), other);
  });

  it("Cash on Delivery sells straight from stock, and a cancellation restocks", async () => {
    const o = await newOrder();
    await withTx((tx) => sellStock(tx, o, [{ variantId, qty: 1 }], "COD sale"));
    expect(await stockOf()).toBe(0);
    const second = await newOrder();
    await expect(
      withTx((tx) => sellStock(tx, second, [{ variantId, qty: 1 }], "COD sale")),
    ).rejects.toBeInstanceOf(OutOfStock);
    await withTx((tx) => restock(tx, o, [{ variantId, qty: 1 }], "cancel_restock", "cancelled"));
    expect(await stockOf()).toBe(1);
    expect(await ledgerOf()).toBe(await stockOf());
  });
});
