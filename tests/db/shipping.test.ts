import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { isolateIntegrations } from "./isolate";
import {
  adminUsers,
  customers,
  fragrances,
  orderEvents,
  orders,
  returns,
  settings,
  shipments,
  stockMovements,
  variants,
} from "@/db/schema";
import { placeOrderSchema } from "@/lib/checkout";
import { adjustStock } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { placeOrder } from "@/server/orders/place";
import { mockNotice } from "@/server/payments/mock";
import { settleNotice } from "@/server/payments/service";
import { mockWebhook } from "@/server/shipping/mock";
import {
  handleCourierWebhook,
  recordReturn,
  sendMany,
  sendToCourier,
  simulateCourier,
} from "@/server/shipping/service";
import { loadLabels, renderLabels } from "@/server/shipping/label";
import { saveIntegration } from "@/server/integrations";

/** Shipping against a real database, through the test courier and a stubbed Steadfast */
const RUN = Date.now().toString(36);
const SLUG = `zz-ship-${RUN}`;
const SKU = `ZS-${RUN.toUpperCase()}-50`;
const EMAIL = `zz-ship-${RUN}@example.com`;
const admin = { id: `zz-ship-admin-${RUN}`, email: `zz-ship-admin-${RUN}@zalfi.test` };
let seq = 0;
const phone = () => `0166${String((Date.now() + seq++) % 10_000_000).padStart(7, "0")}`;
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
const orderOf = async (id: number) =>
  (await poolDb().select().from(orders).where(eq(orders.id, id)))[0]!;
const shipmentOf = async (orderId: number) =>
  (
    await poolDb()
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(shipments.id)
  ).at(-1)!;

async function order(method: "cod" | "sslcommerz" = "cod") {
  const p = phone();
  const items = [{ sku: SKU, qty: 2 }];
  const q = await quoteBag({ items, district: "Sylhet", area: "Zindabazar" }, p);
  const placed = await placeOrder(
    placeOrderSchema.parse({
      name: "Ship Tester",
      phone: p,
      email: EMAIL,
      district: "Sylhet",
      area: "Zindabazar",
      street: "House 4, Road 2",
      items,
      paymentMethod: method,
      expectedTotal: q.total,
      idempotencyKey: `${SLUG}-${Math.random().toString(36).slice(2)}`,
    }),
    p,
  );
  return (await poolDb().select().from(orders).where(eq(orders.number, placed.number)))[0]!;
}

beforeAll(async () => {
  await providers.save();
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Ship",
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
    .values({ fragranceId: f!.id, sku: SKU, sizeMl: 50, pricePoisha: 300_000, stock: 0 })
    .returning({ id: variants.id });
  variantId = v!.id;
  await withTx((tx) => adjustStock(tx, { variantId, delta: 40, type: "initial" }));
  const pinned = {
    payments: { sslcommerzEnabled: true, codEnabled: true, unpaidExpiryMinutes: 30 },
    shipping: { defaultCourier: "mock" },
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
    sql`delete from webhook_events where event_id like ${`${RUN}%`} or event_id like ${"MOCK-%"}`,
  );
  for (const [key, value] of saved)
    if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, key));
    else await poolDb().update(settings).set({ value }).where(eq(settings.key, key));
});

describe("shipping", () => {
  it("sends a cash-on-delivery order with the cash to collect, once", async () => {
    const o = await order();
    const r = await sendToCourier(o.id, {}, admin);
    expect(r.consignmentId).toMatch(/^MOCK-/);
    const s = await shipmentOf(o.id);
    expect(s).toMatchObject({
      courier: "mock",
      status: "awaiting_pickup",
      active: true,
      codAmount: o.total,
    });
    expect(await orderOf(o.id)).toMatchObject({
      status: "packed",
      courier: "mock",
      trackingCode: s.trackingCode,
    });
    await expect(sendToCourier(o.id, {}, admin)).rejects.toThrow(/already with Test courier/);
  });

  it("moves the order with the courier, marks cash paid on delivery, and ignores stale news", async () => {
    const o = await order();
    await sendToCourier(o.id, {}, admin);
    const s = await shipmentOf(o.id);
    await simulateCourier(s.id, "picked_up");
    expect((await orderOf(o.id)).status).toBe("shipped");
    await simulateCourier(s.id, "out_for_delivery");
    expect((await orderOf(o.id)).status).toBe("out_for_delivery");
    await simulateCourier(s.id, "delivered");
    expect(await orderOf(o.id)).toMatchObject({ status: "delivered", paymentStatus: "paid" });
    expect((await shipmentOf(o.id)).active).toBe(false);
    // A late "in transit" changes nothing
    await simulateCourier(s.id, "in_transit");
    expect((await orderOf(o.id)).status).toBe("delivered");
    expect((await shipmentOf(o.id)).status).toBe("delivered");
  });

  it("jumps over steps the courier skips (packed → delivered)", async () => {
    const o = await order();
    await sendToCourier(o.id, {}, admin);
    await simulateCourier((await shipmentOf(o.id)).id, "delivered");
    const states = (
      await poolDb()
        .select()
        .from(orderEvents)
        .where(eq(orderEvents.orderId, o.id))
        .orderBy(asc(orderEvents.id))
    )
      .map((e) => e.toStatus)
      .filter(Boolean);
    expect(states).toEqual(["confirmed", "packed", "shipped", "delivered"]);
  });

  it("counts failed attempts, re-attempts, and records a return with restock", async () => {
    const before = await stockOf();
    const o = await order();
    expect(await stockOf()).toBe(before - 2);
    await sendToCourier(o.id, {}, admin);
    const s = await shipmentOf(o.id);
    await simulateCourier(s.id, "delivery_failed");
    expect((await orderOf(o.id)).status).toBe("delivery_failed");
    await simulateCourier(s.id, "in_transit");
    expect((await orderOf(o.id)).status).toBe("shipped");
    await simulateCourier(s.id, "delivery_failed");
    expect((await shipmentOf(o.id)).attempts).toBe(2);
    await simulateCourier(s.id, "returned");
    const attention = (
      await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, o.id))
    )
      .filter((e) => e.type === "attention")
      .map((e) => e.message);
    expect(attention.join(" ")).toMatch(/returned the parcel/);

    await recordReturn(
      o.id,
      { reason: "Customer refused.", condition: "unopened", restock: true },
      admin,
    );
    expect((await orderOf(o.id)).status).toBe("returned");
    expect(await stockOf()).toBe(before);
    const [ret] = await poolDb().select().from(returns).where(eq(returns.orderId, o.id));
    expect(ret).toMatchObject({ condition: "unopened", restocked: true });
    expect(await ledgerOf()).toBe(await stockOf());
  });

  it("collects nothing for an order paid online, and won't send one that isn't paid", async () => {
    const o = await order("sslcommerz");
    await expect(sendToCourier(o.id, {}, admin)).rejects.toThrow(/hasn't been paid/);
    const [p] = await poolDb()
      .execute<{ tran_id: string; amount: number }>(
        sql`select tran_id, amount from payments where order_id = ${o.id}`,
      )
      .then((r) => r.rows);
    await settleNotice("mock", mockNotice(p!.tran_id, Number(p!.amount), "success"), "ipn");
    await sendToCourier(o.id, {}, admin);
    expect((await shipmentOf(o.id)).codAmount).toBe(0);
  });

  it("sends in bulk and says why some couldn't go", async () => {
    const [a, b] = [await order(), await order("sslcommerz")];
    const r = await sendMany([a.id, b.id], "mock", admin);
    expect(r.sent).toBe(1);
    expect(r.skipped[0]).toMatch(/hasn't been paid/);
  });

  it("refuses unsigned or repeated webhooks", async () => {
    const o = await order();
    await sendToCourier(o.id, {}, admin);
    const s = await shipmentOf(o.id);
    const forged = { ...mockWebhook(s.consignmentId!, "delivered"), sig: "nope" };
    expect(await handleCourierWebhook("mock", new Headers(), forged)).toBe(401);
    expect((await orderOf(o.id)).status).toBe("packed");
    const real = mockWebhook(s.consignmentId!, "picked_up");
    expect(await handleCourierWebhook("mock", new Headers(), real)).toBe(200);
    expect(await handleCourierWebhook("mock", new Headers(), real)).toBe(200);
    const events = (
      await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, o.id))
    ).filter((e) => e.type === "courier" && e.message.includes("Picked up"));
    expect(events).toHaveLength(1);
  });

  it("takes Steadfast webhooks only with our token, and trusts its API's status", async () => {
    vi.stubEnv("STEADFAST_API_KEY", "key");
    vi.stubEnv("STEADFAST_SECRET_KEY", "secret");
    vi.stubEnv("STEADFAST_WEBHOOK_TOKEN", "hook-token");
    const fetch = vi.fn(async (url: string) => {
      if (url.includes("/create_order"))
        return Response.json({
          status: 200,
          consignment: {
            consignment_id: `${RUN}${seq++}`,
            tracking_code: `SF${RUN}${seq}`,
            status: "in_review",
          },
        });
      return Response.json({ status: 200, delivery_status: "delivered" });
    });
    vi.stubGlobal("fetch", fetch);
    const o = await order();
    await sendToCourier(o.id, { courier: "steadfast" }, admin);
    const s = await shipmentOf(o.id);
    expect(s).toMatchObject({ courier: "steadfast", status: "in_review", codAmount: o.total });
    const body = {
      notification_type: "delivery_status",
      consignment_id: s.consignmentId,
      status: "pending",
      updated_at: new Date().toISOString(),
    };
    expect(
      await handleCourierWebhook("steadfast", new Headers({ authorization: "Bearer wrong" }), body),
    ).toBe(401);
    expect(
      await handleCourierWebhook(
        "steadfast",
        new Headers({ authorization: "Bearer hook-token" }),
        body,
      ),
    ).toBe(200);
    // The payload said "pending"; the API says "delivered", and the API wins
    expect(await orderOf(o.id)).toMatchObject({ status: "delivered", paymentStatus: "paid" });
  });

  it("sends with CarryBee, takes its webhooks only with the secret, and trusts its API", async () => {
    await saveIntegration(
      "carrybee",
      {
        mode: "sandbox",
        enabled: true,
        values: {
          clientId: "cid",
          clientSecret: "csecret",
          clientContext: "cctx",
          storeId: "store-1",
          webhookSecret: "cb-secret",
        },
      },
      admin,
    );
    const consignment = `${RUN}CB${seq++}`;
    let details: string | null = null;
    const calls: { url: string; body: unknown; headers: Headers }[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : null,
        headers: new Headers(init?.headers),
      });
      if (url.endsWith("/api/v2/cities"))
        return Response.json({ error: false, data: { cities: [{ id: 7, name: "Sylhet" }] } });
      if (url.endsWith("/api/v2/cities/7/zones"))
        return Response.json({
          error: false,
          data: { zones: [{ id: 70, name: "Zindabazar", city_id: 7 }] },
        });
      if (url.endsWith("/api/v2/orders"))
        return Response.json(
          {
            error: false,
            message: "Order created successfully",
            data: {
              order: {
                consignment_id: consignment,
                store_id: "store-1",
                merchant_order_id: "x",
                collectable_amount: "6000",
                cod_fee: 15,
                delivery_fee: "110",
              },
            },
          },
          { status: 201 },
        );
      if (url.includes("/details")) {
        if (!details) throw new TypeError("fetch failed");
        return Response.json({ error: false, data: { transfer_status: details } });
      }
      return Response.json({ error: true, message: "Not found" }, { status: 404 });
    });
    vi.stubGlobal("fetch", fetch);

    const o = await order();
    await sendToCourier(o.id, { courier: "carrybee" }, admin);
    const s = await shipmentOf(o.id);
    expect(s).toMatchObject({
      courier: "carrybee",
      consignmentId: consignment,
      status: "created",
    });
    const sent = calls.find((c) => c.url.endsWith("/api/v2/orders"))!;
    expect(sent.url).toBe("https://sandbox.carrybee.com/api/v2/orders");
    expect(sent.headers.get("client-id")).toBe("cid");
    expect(sent.headers.get("client-context")).toBe("cctx");
    expect(sent.body).toMatchObject({
      store_id: "store-1",
      city_id: 7,
      zone_id: 70,
      collectable_amount: o.total / 100,
    });

    const event = (name: string) => ({
      event: name,
      store_id: "store-1",
      consignment_id: consignment,
      merchant_order_id: o.number,
      timestamptz: new Date().toISOString(),
    });
    const signed = new Headers({ "X-CB-Webhook-Integration-Header": "cb-secret" });
    expect(
      await handleCourierWebhook(
        "carrybee",
        new Headers({ "X-CB-Webhook-Integration-Header": "wrong" }),
        event("order.picked"),
      ),
    ).toBe(401);
    // CarryBee's set-up check names no parcel: accepted, nothing changes
    expect(await handleCourierWebhook("carrybee", signed, { event: "webhook.integration" })).toBe(
      200,
    );
    expect((await orderOf(o.id)).status).toBe("packed");
    // The details API can't be reached: the signed payload stands
    const picked = event("order.picked");
    expect(await handleCourierWebhook("carrybee", signed, picked)).toBe(200);
    expect(await handleCourierWebhook("carrybee", signed, picked)).toBe(200);
    expect(await orderOf(o.id)).toMatchObject({ status: "shipped" });
    expect((await shipmentOf(o.id)).status).toBe("picked");
    // The API answers again, and wins over the payload
    details = "Delivered";
    expect(await handleCourierWebhook("carrybee", signed, event("order.in-transit"))).toBe(200);
    expect(await orderOf(o.id)).toMatchObject({ status: "delivered", paymentStatus: "paid" });
  });

  it("prints labels for parcels with the courier", async () => {
    const o = await order();
    await sendToCourier(o.id, {}, admin);
    const data = await loadLabels([o.id]);
    expect(data[0]).toMatchObject({ number: o.number, cod: o.total, courier: "Test courier" });
    const pdf = await renderLabels(data);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
