import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isolateIntegrations } from "./isolate";
import {
  adminUsers,
  customers,
  fragrances,
  orderEvents,
  orders,
  payments,
  settings,
  stockMovements,
  stockReservations,
  variants,
} from "@/db/schema";
import { placeOrderSchema } from "@/lib/checkout";
import { adjustStock, releaseExpiredReservations } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { expireUnpaidOrders, moveOrders } from "@/server/orders/manage";
import { placeOrder } from "@/server/orders/place";
import { mockNotice } from "@/server/payments/mock";
import { issueRefund } from "@/server/payments/refunds";
import { firstDelivery, settleNotice, startPayment } from "@/server/payments/service";

/**
 * Online payment against a real database, through the test gateway: the same settle code the
 * SSLCommerz IPN and return pages use. Settings are pinned for the run and restored afterwards.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-pay-${RUN}`;
const SKU = `ZP-${RUN.toUpperCase()}-50`;
const EMAIL = `zz-pay-${RUN}@example.com`;
const admin = { id: `zz-pay-admin-${RUN}`, email: `zz-pay-admin-${RUN}@zalfi.test` };
let seq = 0;
const phone = () => `0177${String((Date.now() + seq++) % 10_000_000).padStart(7, "0")}`;
let variantId = 0;
const saved = new Map<string, unknown>();
const providers = isolateIntegrations();

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
const orderOf = async (number: string) =>
  (await poolDb().select().from(orders).where(eq(orders.number, number)))[0]!;
const paymentsOf = async (orderId: number) =>
  poolDb().select().from(payments).where(eq(payments.orderId, orderId)).orderBy(payments.id);
const events = async (orderId: number, type: string) =>
  (await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, orderId))).filter(
    (e) => e.type === type,
  );

async function online(method: "sslcommerz" | "cod" = "sslcommerz") {
  const p = phone();
  const items = [{ sku: SKU, qty: 1 }];
  const q = await quoteBag({ items, district: "Dhaka", area: "Gulshan" }, p);
  const placed = await placeOrder(
    placeOrderSchema.parse({
      name: "Pay Tester",
      phone: p,
      email: EMAIL,
      district: "Dhaka",
      area: "Gulshan",
      street: "Road 1, House 1",
      items,
      paymentMethod: method,
      expectedTotal: q.total,
      idempotencyKey: `${SLUG}-${Math.random().toString(36).slice(2)}`,
    }),
    p,
  );
  const o = await orderOf(placed.number);
  const [pay] = await paymentsOf(o.id);
  return { placed, order: o, payment: pay };
}

beforeAll(async () => {
  await providers.save();
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Pay",
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
    .values({ fragranceId: f!.id, sku: SKU, sizeMl: 50, pricePoisha: 200_000, stock: 0 })
    .returning({ id: variants.id });
  variantId = v!.id;
  await withTx((tx) => adjustStock(tx, { variantId, delta: 10, type: "initial" }));
  const pinned = {
    payments: { sslcommerzEnabled: true, codEnabled: true, unpaidExpiryMinutes: 30 },
    shipping: {},
    integrations: {},
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
  await providers.restore();
  await new Promise((r) => setTimeout(r, 2500));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.email, EMAIL));
  await poolDb().delete(fragrances).where(eq(fragrances.slug, SLUG));
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
  await poolDb().execute(
    sql`delete from webhook_events where event_id like ${"ZLF-%"} and received_at > now() - interval '1 hour' and provider like 'test-%'`,
  );
  for (const [key, value] of saved)
    if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, key));
    else await poolDb().update(settings).set({ value }).where(eq(settings.key, key));
});

describe("online payment", () => {
  it("opens the test gateway, holds the bottle, and confirms only after validation", async () => {
    const before = await stockOf();
    const { placed, order, payment } = await online();
    expect(placed.status).toBe("pending_payment");
    expect(placed.next).toBe(`/checkout/pay/mock?t=${encodeURIComponent(payment!.tranId)}`);
    expect(payment).toMatchObject({ status: "initiated", provider: "mock", amount: order.total });
    expect(await stockOf()).toBe(before);

    const notice = mockNotice(payment!.tranId, payment!.amount, "success");
    expect(await settleNotice("mock", notice, "ipn")).toEqual({
      outcome: "paid",
      token: order.accessToken,
    });
    const o = await orderOf(order.number);
    expect(o).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(await stockOf()).toBe(before - 1);
    const [held] = await poolDb()
      .select()
      .from(stockReservations)
      .where(eq(stockReservations.orderId, order.id));
    expect(held?.releasedAt).not.toBeNull();
    const [p] = await paymentsOf(order.id);
    expect(p).toMatchObject({ status: "paid", methodReported: "MOCK-Test card" });
    expect((p!.validation as { accepted: boolean }).accepted).toBe(true);

    // The browser comes back with the same notice: nothing changes
    expect((await settleNotice("mock", notice, "return")).outcome).toBe("paid");
    expect(await stockOf()).toBe(before - 1);
    expect((await events(order.id, "payment")).length).toBe(1);
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("refuses forged and mismatched payments", async () => {
    const { order, payment } = await online();
    const real = mockNotice(payment!.tranId, payment!.amount, "success");
    // A valid-looking notice whose validation ID was tampered with
    const forged = { ...real, val_id: real.val_id.replace(/\.\d+\./, ".1.") };
    expect((await settleNotice("mock", forged, "ipn")).outcome).toBe("failed");
    expect((await orderOf(order.number)).paymentStatus).not.toBe("paid");

    // Paid the wrong amount: validated by the gateway, refused by us
    const { order: o2, payment: p2 } = await online();
    expect(
      (await settleNotice("mock", mockNotice(p2!.tranId, p2!.amount, "wrong-amount"), "ipn"))
        .outcome,
    ).toBe("failed");
    const [failed] = await paymentsOf(o2.id);
    expect(failed!.status).toBe("failed");
    expect((failed!.validation as { reason: string }).reason).toMatch(/amount/);
    expect(await orderOf(o2.number)).toMatchObject({
      status: "pending_payment",
      paymentStatus: "failed",
    });

    // The customer tries again with a new attempt, and it goes through
    const url = await startPayment(o2.id);
    const retry = (await paymentsOf(o2.id)).find((p) => p.status === "initiated")!;
    expect(url).toContain(encodeURIComponent(retry.tranId));
    expect(retry.tranId).not.toBe(p2!.tranId);
    await settleNotice("mock", mockNotice(retry.tranId, retry.amount, "success"), "return");
    expect((await orderOf(o2.number)).status).toBe("confirmed");
    void order;
  });

  it("records signed failures and cancellations, and ignores unsigned ones", async () => {
    const { order, payment } = await online();
    const unsigned = { ...mockNotice(payment!.tranId, payment!.amount, "fail"), mock_sig: "x" };
    expect((await settleNotice("mock", unsigned, "return")).outcome).toBe("failed");
    expect((await paymentsOf(order.id))[0]!.status).toBe("initiated");

    await settleNotice("mock", mockNotice(payment!.tranId, payment!.amount, "cancel"), "return");
    expect((await paymentsOf(order.id))[0]!.status).toBe("cancelled");
    expect((await orderOf(order.number)).paymentStatus).toBe("unpaid");

    const { order: o2, payment: p2 } = await online();
    await settleNotice("mock", mockNotice(p2!.tranId, p2!.amount, "fail"), "ipn");
    expect(await orderOf(o2.number)).toMatchObject({
      status: "pending_payment",
      paymentStatus: "failed",
    });
  });

  it("keeps a payment that arrives after the order expired, and flags it", async () => {
    const { order, payment } = await online();
    await poolDb()
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.id, order.id));
    await expireUnpaidOrders();
    expect((await orderOf(order.number)).status).toBe("cancelled");
    await settleNotice("mock", mockNotice(payment!.tranId, payment!.amount, "success"), "ipn");
    expect(await orderOf(order.number)).toMatchObject({
      status: "cancelled",
      paymentStatus: "paid",
    });
    expect((await events(order.id, "attention"))[0]?.message).toMatch(
      /after the order had been cancelled/,
    );
  });

  it("when the bottles sold out during payment: paid, held for the admin, never auto-cancelled", async () => {
    // Earlier tests leave unpaid orders holding bottles: let them go
    await poolDb()
      .update(stockReservations)
      .set({ releasedAt: new Date() })
      .where(
        and(
          eq(stockReservations.variantId, variantId),
          sql`${stockReservations.releasedAt} is null`,
        ),
      );
    await setStock(1);
    const { order, payment } = await online();
    // Its hold lapses, and someone else buys the last bottle
    await poolDb()
      .update(stockReservations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(stockReservations.orderId, order.id));
    await releaseExpiredReservations(poolDb());
    await online("cod");
    expect(await stockOf()).toBe(0);

    await settleNotice("mock", mockNotice(payment!.tranId, payment!.amount, "success"), "ipn");
    expect(await orderOf(order.number)).toMatchObject({
      status: "pending_payment",
      paymentStatus: "paid",
    });
    expect((await events(order.id, "attention"))[0]?.message).toMatch(/sold out/);
    await poolDb()
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.id, order.id));
    await expireUnpaidOrders();
    expect((await orderOf(order.number)).status).toBe("pending_payment");

    await expect(moveOrders([order.id], "confirmed", admin)).rejects.toThrow();
    await setStock(1);
    await moveOrders([order.id], "confirmed", admin);
    expect((await orderOf(order.number)).status).toBe("confirmed");
    expect(await stockOf()).toBe(0);
    expect(await ledgerOf()).toBe(await stockOf());
    await setStock(10);
  });

  it("acknowledges a repeated provider callback only once", async () => {
    const id = `ZLF-TEST-${RUN}:VALID:x`;
    expect(await firstDelivery(`test-${RUN}`, id)).toBe(true);
    expect(await firstDelivery(`test-${RUN}`, id)).toBe(false);
    await poolDb().execute(sql`delete from webhook_events where provider = ${`test-${RUN}`}`);
  });
});

describe("refunds", () => {
  it("refunds part, then the rest, and never more than was paid", async () => {
    const { order, payment } = await online();
    await settleNotice("mock", mockNotice(payment!.tranId, payment!.amount, "success"), "ipn");
    const half = Math.floor(order.total / 2);
    const r1 = await issueRefund(order.id, { amount: half, reason: "Goodwill" }, admin);
    expect(r1.status).toBe("completed");
    expect((await orderOf(order.number)).paymentStatus).toBe("partially_refunded");
    await expect(
      issueRefund(order.id, { amount: order.total, reason: "Too much" }, admin),
    ).rejects.toThrow(/up to/);
    await issueRefund(order.id, { amount: order.total - half, reason: "Rest" }, admin);
    expect((await orderOf(order.number)).paymentStatus).toBe("refunded");
    await expect(issueRefund(order.id, { amount: 100, reason: "Again" }, admin)).rejects.toThrow(
      /in full/,
    );
    expect((await events(order.id, "refund")).length).toBe(2);
  });

  it("records a cash-on-delivery refund by hand, once it was delivered", async () => {
    const { order } = await online("cod");
    await expect(issueRefund(order.id, { amount: 100, reason: "x" }, admin)).rejects.toThrow(
      /hasn't been paid/,
    );
    for (const s of ["packed", "shipped", "delivered"] as const)
      await moveOrders([order.id], s, admin);
    const r = await issueRefund(order.id, { amount: 50_000, reason: "Scratched box" }, admin);
    expect(r).toMatchObject({ status: "completed", providerRef: "manual", paymentId: null });
    expect((await orderOf(order.number)).paymentStatus).toBe("partially_refunded");
  });
});
