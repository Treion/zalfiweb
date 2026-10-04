import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  adminUsers,
  auditLog,
  customers,
  fragrances,
  integrations,
  orderEvents,
  orders,
  payments,
  settings,
  shipments,
  stockReservations,
  variants,
} from "@/db/schema";
import { placeOrderSchema, type PaymentMethod } from "@/lib/checkout";
import { adjustStock } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { getIntegration, saveIntegration, webhookToken } from "@/server/integrations";
import { placeOrder } from "@/server/orders/place";
import { expireUnpaidOrders } from "@/server/orders/manage";
import {
  confirmManualPayment,
  recordPaymentByHand,
  rejectManualPayment,
  submitManualPayment,
} from "@/server/payments/manual";
import { issueRefund } from "@/server/payments/refunds";
import { settleNotice } from "@/server/payments/service";
import { handleCourierWebhook, recordManualStatus, sendToCourier } from "@/server/shipping/service";
import { orderTracking } from "@/server/shipping/tracking-query";
import { isolateIntegrations } from "./isolate";

/**
 * Providers set up in the admin, against a real database: keys sealed and audited without their
 * values, the gateway fallback, aamarPay's unsigned callbacks, bKash and Nagad by hand, RedX, and
 * "other courier". Provider APIs are stubbed (fetch); settings and providers are restored after.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-int-${RUN}`;
const SKU = `ZI-${RUN.toUpperCase()}-50`;
const EMAIL = `zz-int-${RUN}@example.com`;
const admin = { id: `zz-int-admin-${RUN}`, email: `zz-int-admin-${RUN}@zalfi.test` };
let seq = 0;
const phone = () => `0188${String((Date.now() + seq++) % 10_000_000).padStart(7, "0")}`;
const saved = new Map<string, unknown>();
const providers = isolateIntegrations();
let variantId = 0;

const orderOf = async (id: number) =>
  (await poolDb().select().from(orders).where(eq(orders.id, id)))[0]!;
const paymentsOf = async (orderId: number) =>
  poolDb().select().from(payments).where(eq(payments.orderId, orderId)).orderBy(payments.id);
const stockOf = async () =>
  (
    await poolDb().select({ s: variants.stock }).from(variants).where(eq(variants.id, variantId))
  )[0]!.s;

async function place(method: PaymentMethod) {
  const p = phone();
  const items = [{ sku: SKU, qty: 1 }];
  const q = await quoteBag({ items, district: "Dhaka", area: "Dhanmondi" }, p);
  const placed = await placeOrder(
    placeOrderSchema.parse({
      name: "Int Tester",
      phone: p,
      email: EMAIL,
      district: "Dhaka",
      area: "Dhanmondi",
      street: "Road 7A, House 21",
      items,
      paymentMethod: method,
      expectedTotal: q.total,
      idempotencyKey: `${SLUG}-${Math.random().toString(36).slice(2)}`,
    }),
    p,
  );
  const [o] = await poolDb().select().from(orders).where(eq(orders.number, placed.number));
  return { placed, order: o! };
}

/** Routes the providers' API calls to canned answers */
function stubFetch(routes: [RegExp, (url: string, init?: RequestInit) => Response][]) {
  const fn = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const hit = routes.find(([re]) => re.test(url));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return hit[1](url, init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeAll(async () => {
  await providers.save();
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Int",
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
  await withTx((tx) => adjustStock(tx, { variantId, delta: 20, type: "initial" }));
  const pinned = {
    payments: {
      sslcommerzEnabled: true,
      codEnabled: true,
      unpaidExpiryMinutes: 30,
      manual: {
        enabled: true,
        holdHours: 24,
        bkash: { enabled: true, number: "01711000111", accountType: "personal" },
        nagad: { enabled: true, number: "01811000222", accountType: "personal" },
      },
    },
    shipping: { defaultCourier: "mock", manualCourierEnabled: true },
    integrations: { gatewayOrder: ["sslcommerz", "aamarpay"] },
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
  await new Promise((r) => setTimeout(r, 2000));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.email, EMAIL));
  await poolDb().delete(fragrances).where(eq(fragrances.slug, SLUG));
  await poolDb().delete(auditLog).where(eq(auditLog.actorId, admin.id));
  await poolDb().delete(integrations);
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
  await providers.restore();
  for (const [key, value] of saved)
    if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, key));
    else await poolDb().update(settings).set({ value }).where(eq(settings.key, key));
});

describe("keys saved in the admin", () => {
  it("seals secrets, shows them nowhere, and audits only which fields changed", async () => {
    await saveIntegration(
      "sslcommerz",
      { values: { storeId: "zalfitest", storePassword: "very-secret-pass" }, mode: "sandbox" },
      admin,
    );
    const [row] = await poolDb()
      .select()
      .from(integrations)
      .where(eq(integrations.provider, "sslcommerz"));
    expect(row!.config).toEqual({ storeId: "zalfitest" });
    expect(row!.secrets).toMatch(/^v1:/);
    expect(row!.secrets).not.toContain("very-secret");
    const r = await getIntegration("sslcommerz");
    expect(r).toMatchObject({ source: "admin", configured: true, enabled: false, mode: "sandbox" });
    const [log] = await poolDb()
      .select()
      .from(auditLog)
      .where(
        and(eq(auditLog.actorId, admin.id), eq(auditLog.action, "integration.sslcommerz.update")),
      );
    expect(JSON.stringify(log)).not.toContain("very-secret");
    expect(log!.after).toMatchObject({ fieldsChanged: ["storeId", "storePassword"] });
  });

  it("copies keys from the environment on the first save, and keeps a secret left blank", async () => {
    vi.stubEnv("STEADFAST_API_KEY", "env-api");
    vi.stubEnv("STEADFAST_SECRET_KEY", "env-secret");
    expect((await getIntegration("steadfast")).source).toBe("env");
    await saveIntegration("steadfast", { values: { apiKey: "admin-api", secretKey: "" } }, admin);
    vi.unstubAllEnvs();
    const r = await getIntegration("steadfast");
    expect(r.source).toBe("admin");
    expect(r.values).toEqual({ apiKey: "admin-api", secretKey: "env-secret" });
    await expect(saveIntegration("redx", { enabled: true }, admin)).rejects.toThrow(
      /Fill in API access token, Pickup store/,
    );
  });
});

describe("gateways", () => {
  it("falls back to aamarPay when SSLCommerz won't open, and says so on the timeline", async () => {
    await saveIntegration("sslcommerz", { enabled: true }, admin);
    await saveIntegration(
      "aamarpay",
      {
        values: { storeId: "aamarpaytest", signatureKey: "dbb74894e82415a2f7ff0ec3a97e4183" },
        mode: "sandbox",
        enabled: true,
      },
      admin,
    );
    const fetch = stubFetch([
      [
        /sslcommerz\.com\/gwprocess/,
        () =>
          Response.json({
            status: "FAILED",
            failedreason: "Store Credential Error Or Store is De-active",
          }),
      ],
      [
        /aamarpay\.com\/jsonpost\.php/,
        () =>
          Response.json({
            result: "true",
            payment_url: "https://sandbox.aamarpay.com/paynow.php?track=T1",
          }),
      ],
    ]);
    const { placed, order } = await place("sslcommerz");
    expect(placed.next).toBe("https://sandbox.aamarpay.com/paynow.php?track=T1");
    const [first, second] = await paymentsOf(order.id);
    expect(first).toMatchObject({ provider: "sslcommerz", status: "failed" });
    expect(second).toMatchObject({ provider: "aamarpay", status: "initiated" });
    const body = JSON.parse(String(fetch.mock.calls.at(-1)![1]!.body));
    expect(body).toMatchObject({ tran_id: second!.tranId, currency: "BDT", type: "json" });
    expect(body.cancel_url).toContain(`tran=${second!.tranId}`);
    const ev = await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
    expect(
      ev.some((e) =>
        e.message.includes("SSLCommerz couldn't open a payment page, so aamarPay took over"),
      ),
    ).toBe(true);
    // The owner sees SSLCommerz failing
    expect((await getIntegration("sslcommerz")).lastCheck).toMatchObject({
      ok: false,
      source: "live",
    });
    await saveIntegration("sslcommerz", { enabled: false }, admin);
  });

  it("pays an aamarPay order only after the transaction check, and never fails one on its word", async () => {
    let check: Record<string, string> | string = "Invalid Request";
    stubFetch([
      [
        /aamarpay\.com\/jsonpost\.php/,
        () =>
          Response.json({
            result: "true",
            payment_url: "https://sandbox.aamarpay.com/paynow.php?track=T2",
          }),
      ],
      [/trxcheck/, () => (typeof check === "string" ? new Response(check) : Response.json(check))],
    ]);
    const before = await stockOf();
    const { order } = await place("sslcommerz");
    const [pay] = await paymentsOf(order.id);
    expect(pay!.provider).toBe("aamarpay");

    // An unsigned "failed" (anyone could post it) changes nothing while aamarPay knows nothing
    const r1 = await settleNotice(
      "aamarpay",
      { mer_txnid: pay!.tranId, pay_status: "Failed" },
      "return",
    );
    expect(r1.outcome).toBe("failed");
    expect((await paymentsOf(order.id))[0]!.status).toBe("initiated");

    // A "successful" callback is checked: the amount must match
    check = {
      mer_txnid: pay!.tranId,
      pg_txnid: "AAM1",
      pay_status: "Successful",
      status_code: "2",
      amount: (order.total / 100).toFixed(2),
      currency_merchant: "BDT",
      payment_type: "bKash-bKash",
    };
    const r2 = await settleNotice(
      "aamarpay",
      { mer_txnid: pay!.tranId, pay_status: "Successful" },
      "return",
    );
    expect(r2.outcome).toBe("paid");
    expect(await orderOf(order.id)).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(await stockOf()).toBe(before - 1);

    // Refunds are made in aamarPay's panel and recorded
    const refund = await issueRefund(order.id, { amount: 10_000, reason: "Test" }, admin);
    expect(refund).toMatchObject({ status: "completed", providerRef: "panel" });
  });

  it("records a failure the transaction check confirms, even from the empty cancel address", async () => {
    stubFetch([
      [
        /aamarpay\.com\/jsonpost\.php/,
        () =>
          Response.json({
            result: "true",
            payment_url: "https://sandbox.aamarpay.com/paynow.php?track=T3",
          }),
      ],
      [
        /trxcheck/,
        (url) =>
          Response.json({
            mer_txnid: new URL(url).searchParams.get("request_id"),
            pay_status: "Cancelled",
          }),
      ],
    ]);
    const { order } = await place("sslcommerz");
    const [pay] = await paymentsOf(order.id);
    const r = await settleNotice("aamarpay", { _tran: pay!.tranId, _outcome: "cancel" }, "return");
    expect(r.outcome).toBe("cancelled");
    expect((await paymentsOf(order.id))[0]!.status).toBe("cancelled");
    await saveIntegration("aamarpay", { enabled: false }, admin);
  });
});

describe("bKash and Nagad, by hand", () => {
  it("holds the bottles, takes the TrxID, and confirms only when the team does", async () => {
    const before = await stockOf();
    const { placed, order } = await place("manual");
    expect(placed.status).toBe("pending_payment");
    expect(placed.next).toContain("/checkout/thanks");
    const hours = (order.expiresAt!.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);

    await expect(
      submitManualPayment(order.accessToken, {
        wallet: "bkash",
        sender: "01712345678",
        trxId: "bad!",
      }),
    ).rejects.toThrow(/transaction ID/);
    await submitManualPayment(order.accessToken, {
      wallet: "bkash",
      sender: "01712-345678",
      trxId: `9gh${RUN}`.slice(0, 10),
    });
    const o1 = await orderOf(order.id);
    expect(o1.expiresAt).toBeNull();
    const [claim] = await paymentsOf(order.id);
    expect(claim).toMatchObject({
      provider: "manual",
      status: "initiated",
      methodReported: "bkash",
    });
    // The clock stopped: it doesn't lapse, and its bottles stay held
    await poolDb()
      .update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.id, -1));
    await expireUnpaidOrders();
    expect((await orderOf(order.id)).status).toBe("pending_payment");
    const [held] = await poolDb()
      .select()
      .from(stockReservations)
      .where(eq(stockReservations.orderId, order.id));
    expect(held!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 10 * 86_400_000);

    // A second order can't use the same TrxID
    const other = await place("manual");
    await expect(
      submitManualPayment(other.order.accessToken, {
        wallet: "bkash",
        sender: "01712345678",
        trxId: `9gh${RUN}`.slice(0, 10),
      }),
    ).rejects.toThrow(/used already/);

    // Not found: the customer can send it again
    await rejectManualPayment(claim!.id, "No payment with that transaction ID", admin);
    const o2 = await orderOf(order.id);
    expect(o2).toMatchObject({ status: "pending_payment", paymentStatus: "failed" });
    expect(o2.expiresAt).not.toBeNull();
    await submitManualPayment(order.accessToken, {
      wallet: "nagad",
      sender: "01812345678",
      trxId: `7A${RUN}`.slice(0, 8),
    });
    const [, again] = await paymentsOf(order.id);
    await expect(confirmManualPayment(again!.id, { amount: 1, note: "" }, admin)).rejects.toThrow(
      /ask the customer/,
    );
    expect(
      await confirmManualPayment(again!.id, { amount: again!.amount, note: "Seen in app" }, admin),
    ).toBe("paid");
    expect(await orderOf(order.id)).toMatchObject({ status: "confirmed", paymentStatus: "paid" });
    expect(await stockOf()).toBe(before - 2 + 1); // this order sold one; the other still holds one (held, not sold)
  });

  it("records a payment made another way, and refunds it by hand", async () => {
    const { order } = await place("cod");
    expect(order.paymentStatus).toBe("unpaid");
    await expect(
      recordPaymentByHand(order.id, { method: "bank", reference: "BRAC-1", amount: 1 }, admin),
    ).rejects.toThrow(/total/);
    expect(
      await recordPaymentByHand(
        order.id,
        { method: "bank", reference: `BRAC-${RUN}`, amount: order.total },
        admin,
      ),
    ).toBe("paid");
    expect((await orderOf(order.id)).paymentStatus).toBe("paid");
    await expect(
      recordPaymentByHand(
        order.id,
        { method: "bank", reference: "X-1", amount: order.total },
        admin,
      ),
    ).rejects.toThrow(/paid already/);
    const r = await issueRefund(order.id, { amount: order.total, reason: "Changed mind" }, admin);
    expect(r).toMatchObject({ status: "completed", providerRef: "manual" });
    expect((await orderOf(order.id)).paymentStatus).toBe("refunded");
  });
});

describe("couriers", () => {
  it("sends with RedX, accepts its webhook only with our token, and trusts its API", async () => {
    await saveIntegration(
      "redx",
      { values: { accessToken: "jwt-token", pickupStoreId: "77" }, mode: "sandbox", enabled: true },
      admin,
    );
    const token = await webhookToken("redx", admin);
    let apiStatus = "ready-for-delivery";
    const fetch = stubFetch([
      [
        /\/areas\?district_name=Dhaka/,
        () =>
          Response.json({
            areas: [
              { id: 5, name: "Dhanmondi" },
              { id: 6, name: "Gulshan 1" },
            ],
          }),
      ],
      [/\/parcel$/, () => Response.json({ tracking_id: `RX${RUN}` })],
      [/\/parcel\/info\//, () => Response.json({ parcel: { status: apiStatus } })],
    ]);
    const { order } = await place("cod");
    await sendToCourier(order.id, { courier: "redx" }, admin);
    const create = fetch.mock.calls.find(([u]) => String(u).endsWith("/parcel"))!;
    expect(JSON.parse(String(create[1]!.body))).toMatchObject({
      delivery_area: "Dhanmondi",
      delivery_area_id: 5,
      pickup_store_id: 77,
      cash_collection_amount: String(order.total / 100),
    });
    const [s] = await poolDb().select().from(shipments).where(eq(shipments.orderId, order.id));
    expect(s).toMatchObject({ courier: "redx", consignmentId: `RX${RUN}` });
    const body = { tracking_number: `RX${RUN}`, status: "ready-for-delivery", timestamp: "1" };
    const at = (t: string) => new URL(`http://x/api/couriers/webhook/redx?token=${t}`);
    expect(await handleCourierWebhook("redx", new Headers(), body, at("nope"))).toBe(401);
    apiStatus = "delivered";
    expect(await handleCourierWebhook("redx", new Headers(), body, at(token!))).toBe(200);
    expect(await orderOf(order.id)).toMatchObject({ status: "delivered", paymentStatus: "paid" });
    expect((await orderTracking(order.id))?.url).toBe(
      `https://redx.com.bd/track-parcel/?trackingId=RX${RUN}`,
    );
  });

  it("keeps updating a courier's parcels after it's switched off, but sends no new ones", async () => {
    stubFetch([
      [/\/areas/, () => Response.json({ areas: [{ id: 5, name: "Dhanmondi" }] })],
      [/\/parcel$/, () => Response.json({ tracking_id: `RY${RUN}` })],
      [/\/parcel\/info\//, () => Response.json({ parcel: { status: "delivery-in-progress" } })],
    ]);
    const { order } = await place("cod");
    await sendToCourier(order.id, { courier: "redx" }, admin);
    await saveIntegration("redx", { enabled: false }, admin);
    const token = (await getIntegration("redx")).webhookToken!;
    const body = { tracking_number: `RY${RUN}`, status: "delivery-in-progress", timestamp: "2" };
    expect(
      await handleCourierWebhook("redx", new Headers(), body, new URL(`http://x/?token=${token}`)),
    ).toBe(200);
    expect((await orderOf(order.id)).status).toBe("out_for_delivery");
    const next = await place("cod");
    await expect(sendToCourier(next.order.id, { courier: "redx" }, admin)).rejects.toThrow(
      /switched off or not set up/,
    );
  });

  it("sends with another courier, tracked by the team, with the customer's link", async () => {
    const { order } = await place("cod");
    await sendToCourier(
      order.id,
      {
        courier: "manual",
        manual: {
          courierName: "Sundarban Courier",
          trackingCode: `SB-${RUN}`,
          trackingUrl: "https://sundarban.example/track",
        },
      },
      admin,
    );
    const [s] = await poolDb().select().from(shipments).where(eq(shipments.orderId, order.id));
    expect(s).toMatchObject({ courier: "manual", consignmentId: `SB-${RUN}`, active: true });
    expect((await orderTracking(order.id))?.url).toBe("https://sundarban.example/track");
    await recordManualStatus(s!.id, "picked_up", admin);
    expect((await orderOf(order.id)).status).toBe("shipped");
    await recordManualStatus(s!.id, "delivered", admin);
    expect(await orderOf(order.id)).toMatchObject({ status: "delivered", paymentStatus: "paid" });
    const ev = await poolDb().select().from(orderEvents).where(eq(orderEvents.orderId, order.id));
    expect(ev.some((e) => e.message.startsWith("Sent to Sundarban Courier"))).toBe(true);
  });
});
