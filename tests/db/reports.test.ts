import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fragrances, orderItems, orders, refunds, variants } from "@/db/schema";
import { poolDb } from "@/server/db/pool";
import * as m from "@/server/reports/metrics";
import { parseRange } from "@/server/reports/range";

/**
 * The report numbers against a real database, on orders written by hand in March 2020 (Dhaka
 * time), so every figure below can be worked out on paper. Nothing else sells in 2020.
 */
const RUN = Date.now().toString(36);
const KEY = `zz-rep-${RUN}`;
const SLUG = `zz-rep-${RUN}`;
const T = 100; // poisha per taka
let fragranceId = 0;
let variantId = 0;

type Spec = {
  at: string;
  status: (typeof orders.$inferInsert)["status"];
  method: "cod" | "sslcommerz";
  paid: boolean;
  zone: "inside_dhaka" | "outside_dhaka";
  bottles: number;
  refunds?: { amount: number; status: "completed" | "pending" }[];
};

// 1 Mar 10:00, 1 Mar 23:30 (still 1 Mar in Dhaka), 2 Mar 00:30 (1 Mar in UTC), then the orders
// that aren't sales: cancelled, waiting for payment, returned
const SPECS: Spec[] = [
  {
    at: "2020-03-01T10:00:00+06:00",
    status: "delivered",
    method: "cod",
    paid: true,
    zone: "inside_dhaka",
    bottles: 1,
  },
  {
    at: "2020-03-01T23:30:00+06:00",
    status: "delivered",
    method: "sslcommerz",
    paid: true,
    zone: "outside_dhaka",
    bottles: 2,
    refunds: [
      { amount: 1000 * T, status: "completed" },
      { amount: 500 * T, status: "pending" },
    ],
  },
  {
    at: "2020-03-02T00:30:00+06:00",
    status: "confirmed",
    method: "cod",
    paid: false,
    zone: "inside_dhaka",
    bottles: 1,
  },
  {
    at: "2020-03-02T12:00:00+06:00",
    status: "cancelled",
    method: "cod",
    paid: false,
    zone: "inside_dhaka",
    bottles: 1,
  },
  {
    at: "2020-03-03T12:00:00+06:00",
    status: "pending_payment",
    method: "sslcommerz",
    paid: false,
    zone: "inside_dhaka",
    bottles: 3,
  },
  {
    at: "2020-03-03T15:00:00+06:00",
    status: "returned",
    method: "cod",
    paid: false,
    zone: "outside_dhaka",
    bottles: 1,
  },
];

const range = parseRange(
  { range: "custom", from: "2020-03-01", to: "2020-03-03" },
  new Date("2020-03-10T00:00:00Z"),
);

beforeAll(async () => {
  const db = poolDb();
  const [f] = await db
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Report",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: false,
      sortOrder: 999,
    })
    .returning({ id: fragrances.id });
  fragranceId = f!.id;
  const [v] = await db
    .insert(variants)
    .values({ fragranceId, sku: `ZR-${RUN}-50`, sizeMl: 50, pricePoisha: 4500 * T, stock: 0 })
    .returning({ id: variants.id });
  variantId = v!.id;

  for (const [i, s] of SPECS.entries()) {
    const subtotal = s.bottles * 4500 * T;
    const shippingFee = (s.zone === "inside_dhaka" ? 70 : 200) * T;
    const [o] = await db
      .insert(orders)
      .values({
        idempotencyKey: `${KEY}-${i}`,
        accessToken: `${KEY}-${i}`,
        customerName: "Report Tester",
        customerPhone: "01700000000",
        customerEmail: `${KEY}@example.com`,
        addressDistrict: "Dhaka",
        addressArea: "Dhanmondi",
        addressStreet: "Road 1",
        zone: s.zone,
        subtotal,
        discount: 0,
        shippingFee,
        total: subtotal + shippingFee,
        paymentMethod: s.method,
        paymentStatus: s.paid ? "paid" : "unpaid",
        status: s.status,
        createdAt: new Date(s.at),
      })
      .returning({ id: orders.id });
    await db.insert(orderItems).values({
      orderId: o!.id,
      variantId,
      fragranceId,
      sku: `ZR-${RUN}-50`,
      name: "Zz Report",
      sizeMl: 50,
      unitPrice: 4500 * T,
      qty: s.bottles,
      lineTotal: subtotal,
    });
    for (const r of s.refunds ?? [])
      await db
        .insert(refunds)
        .values({ orderId: o!.id, amount: r.amount, reason: "test", status: r.status });
  }
});

afterAll(async () => {
  const db = poolDb();
  await db.delete(orders).where(like(orders.idempotencyKey, `${KEY}-%`));
  await db.delete(variants).where(eq(variants.id, variantId));
  await db.delete(fragrances).where(eq(fragrances.id, fragranceId));
});

describe("report numbers", () => {
  it("count sales only, net of completed refunds", async () => {
    // A 4,570 + B 9,200 − 1,000 refunded + C 4,570; the pending refund doesn't count yet
    expect(await m.totals(range.from, range.to)).toEqual({
      revenue: 17_340 * T,
      orders: 3,
      bottles: 4,
      aov: Math.round((18_340 * T) / 3),
    });
  });

  it("group by the Dhaka day, with empty days and the previous period", async () => {
    const s = await m.series(range);
    expect(s.map((p) => [p.label, p.orders, p.revenue])).toEqual([
      ["1 Mar", 2, 12_770 * T],
      ["2 Mar", 1, 4_570 * T],
      ["3 Mar", 0, 0],
    ]);
    // 27–29 Feb 2020 (a leap year): nothing sold
    expect(range.prev.label).toBe("27 Feb – 29 Feb 2020");
    expect(s.every((p) => p.prevOrders === 0 && p.prevRevenue === 0)).toBe(true);
  });

  it("list every order placed by its status, sales or not", async () => {
    const rows = await m.byStatus(range.from, range.to);
    expect(Object.fromEntries(rows.map((r) => [r.status, r.orders]))).toEqual({
      delivered: 2,
      confirmed: 1,
      cancelled: 1,
      pending_payment: 1,
      returned: 1,
    });
  });

  it("split by payment method and zone", async () => {
    const method = Object.fromEntries(
      (await m.byMethod(range.from, range.to)).map((r) => [r.key, [r.orders, r.revenue]]),
    );
    expect(method).toEqual({ cod: [2, 9_140 * T], sslcommerz: [1, 8_200 * T] });
    const zone = Object.fromEntries(
      (await m.byZone(range.from, range.to)).map((r) => [r.key, [r.orders, r.shipping]]),
    );
    expect(zone).toEqual({ inside_dhaka: [2, 140 * T], outside_dhaka: [1, 200 * T] });
  });

  it("sum bottles by fragrance and size at bottle prices", async () => {
    const f = (await m.byFragrance(range.from, range.to)).filter(
      (r) => r.fragranceId === fragranceId,
    );
    expect(f).toEqual([
      { fragranceId, name: "Zz Report", bottles: 4, revenue: 18_000 * T, orders: 3 },
    ]);
    expect(await m.bySize(range.from, range.to)).toEqual([
      { sizeMl: 50, bottles: 4, revenue: 18_000 * T },
    ]);
  });

  it("hourly buckets follow the Dhaka clock", async () => {
    const day = parseRange({ range: "custom", from: "2020-03-01", to: "2020-03-01" }, new Date());
    const s = await m.series(day);
    expect(s).toHaveLength(24);
    expect(s.filter((p) => p.orders).map((p) => p.label)).toEqual(["10 am", "11 pm"]);
  });

  it("leave the 2020 orders out of other periods", async () => {
    const ids = (
      await poolDb()
        .select({ id: orders.id })
        .from(orders)
        .where(like(orders.idempotencyKey, `${KEY}-%`))
    ).map((r) => r.id);
    expect(ids).toHaveLength(SPECS.length);
    const later = await m.totals(
      new Date("2020-03-04T00:00:00+06:00"),
      new Date("2020-04-01T00:00:00+06:00"),
    );
    expect(later.orders).toBe(0);
    expect(
      (await poolDb().select().from(refunds).where(inArray(refunds.orderId, ids))).length,
    ).toBe(2);
  });
});

describe("global search", () => {
  const all = () => true;
  it("finds orders by email, number or phone, however the phone is typed", async () => {
    const { globalSearch } = await import("@/server/search");
    const byEmail = await globalSearch(`${KEY}@example`, all, 3);
    const orders_ = byEmail.find((g) => g.kind === "orders")!;
    expect(orders_.total).toBe(SPECS.length);
    expect(orders_.hits).toHaveLength(3);
    expect(orders_.more).toContain("/admin/orders?q=");
    const number = orders_.hits[0]!.title;
    const exact = (await globalSearch(number, all, 5)).find((g) => g.kind === "orders")!;
    expect(exact.hits[0]!.title).toBe(number);
    for (const typed of ["01700000000", "+880 1700-000000", "1700000000"]) {
      const g = (await globalSearch(typed, all, 50)).find((x) => x.kind === "orders");
      expect(g?.hits.map((h) => h.title)).toContain(number);
    }
  });

  it("shows each group only to admins who may open it", async () => {
    const { globalSearch } = await import("@/server/search");
    const onlyProducts = (p: string) => p === "products.manage";
    const groups = await globalSearch(`${KEY}@example`, onlyProducts, 3);
    expect(groups.find((g) => g.kind === "orders")).toBeUndefined();
    expect(await globalSearch("x", all)).toEqual([]);
  });
});
