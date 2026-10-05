/**
 * Demo data for development: ~90 days of orders (mixed statuses, both shipping zones, coupons,
 * COD and online payments), customers, payments, shipments, refunds, order timelines and the stock
 * movements they imply. It makes the dashboard and reports meaningful while building.
 *
 *   npm run db:seed:demo            (re)creates the demo data; earlier demo data is replaced
 *   npm run db:seed:demo -- --clear removes the demo data only
 *
 * NEVER runs in production: it refuses when NODE_ENV or VERCEL_ENV is "production", and refuses a
 * non-local database unless --allow-remote is passed (for a staging database).
 *
 * Deterministic (seeded random), so every run produces the same store. Demo records are tagged:
 * idempotency keys start with "demo-", customers' emails end with "@demo.zalfi.test", coupons have
 * "[demo]" in their description.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { eq, inArray, like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { DHAKA_CITY_THANAS, DISTRICTS } from "@/lib/bd-geo";
import { mapStatus } from "@/server/shipping/status";
import * as schema from "./schema";

const DEMO_COURIER_STATUS = {
  pathao: {
    transit: "in_transit",
    out: "assigned_for_delivery",
    delivered: "delivered",
    failed: "delivery_failed",
    returned: "returned",
  },
  steadfast: {
    transit: "pending",
    out: "pending",
    delivered: "delivered",
    failed: "cancelled_approval_pending",
    returned: "cancelled",
  },
  mock: {
    transit: "in_transit",
    out: "out_for_delivery",
    delivered: "delivered",
    failed: "delivery_failed",
    returned: "returned",
  },
} as const;

const S = schema;
const DAY = 86_400_000;
const args = new Set(process.argv.slice(2));

function guard(url: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production")
    throw new Error("Refusing to seed demo data in production.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "db.localtest.me"].includes(host) && !args.has("--allow-remote"))
    throw new Error(
      `Refusing to seed demo data into a non-local database (${host}). Pass --allow-remote for staging.`,
    );
}

/* ---------------------------------------------------------------------------------------------- */
/* Deterministic randomness                                                                        */

let seed = 0x2a1f1;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const chance = (p: number) => rnd() < p;
const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1]![0];
}

const FIRST = [
  "Ayesha",
  "Tahmid",
  "Nusrat",
  "Rafi",
  "Sadia",
  "Arif",
  "Maliha",
  "Zarif",
  "Farhana",
  "Imran",
  "Tasnim",
  "Nabil",
  "Raisa",
  "Fahim",
  "Sumaiya",
  "Shuvo",
  "Anika",
  "Sakib",
  "Mehjabin",
  "Tanvir",
  "Lamia",
  "Rehan",
  "Ishrat",
  "Adnan",
  "Prova",
  "Siam",
  "Jarin",
  "Ahnaf",
  "Orpa",
  "Mahir",
];
const LAST = [
  "Rahman",
  "Hossain",
  "Ahmed",
  "Chowdhury",
  "Islam",
  "Karim",
  "Khan",
  "Sultana",
  "Akter",
  "Haque",
  "Siddiqui",
  "Uddin",
  "Talukder",
  "Mahmud",
  "Sarker",
];
const OTHER_DISTRICTS = DISTRICTS.filter((d) => d !== "Dhaka");
const BIG_CITIES = [
  "Chattogram",
  "Sylhet",
  "Gazipur",
  "Narayanganj",
  "Rajshahi",
  "Khulna",
  "Cumilla",
  "Mymensingh",
  "Bogura",
  "Rangpur",
];
const ROADS = [
  "Road 11",
  "Road 27",
  "Lane 4",
  "Avenue 2",
  "Block C, Road 5",
  "Sector 7, Road 14",
  "House 32, Road 3",
  "Flat 5B, House 18",
];
const METHODS = [
  "bKash",
  "bKash",
  "bKash",
  "VISA",
  "Mastercard",
  "Nagad",
  "Nagad",
  "Rocket",
  "AMEX",
];

type Status = (typeof S.orderStatus.enumValues)[number];

async function clearDemo(db: ReturnType<typeof drizzle<typeof schema>>) {
  const demoOrders = db
    .select({ id: S.orders.id })
    .from(S.orders)
    .where(like(S.orders.idempotencyKey, "demo-%"));
  // Remove the demo orders' ledger rows, then their orders (items, events, payments, shipments,
  // refunds, returns and reservations cascade), then put each size's stock back to its ledger sum
  await db.delete(S.stockMovements).where(inArray(S.stockMovements.orderId, demoOrders));
  await db.delete(S.stockMovements).where(eq(S.stockMovements.reason, "Demo restock"));
  await db.delete(S.orders).where(like(S.orders.idempotencyKey, "demo-%"));
  await db.delete(S.customers).where(like(S.customers.email, "%@demo.zalfi.test"));
  await db.delete(S.coupons).where(like(S.coupons.description, "%[demo]%"));
  await db.execute(sql`
    update variants v set stock = coalesce((select sum(m.delta) from stock_movements m where m.variant_id = v.id), 0)`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  guard(url);
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  await db.transaction(async (tx) => {
    await clearDemo(tx as unknown as typeof db);
    if (args.has("--clear")) return;

    const now = Date.now();
    const variants = await tx
      .select({
        id: S.variants.id,
        sku: S.variants.sku,
        sizeMl: S.variants.sizeMl,
        price: S.variants.pricePoisha,
        fragranceId: S.fragrances.id,
        name: S.fragrances.name,
        slug: S.fragrances.slug,
      })
      .from(S.variants)
      .innerJoin(S.fragrances, eq(S.fragrances.id, S.variants.fragranceId))
      .where(eq(S.variants.active, true));
    if (!variants.length) throw new Error("No catalogue: run `npm run db:seed` first.");
    const oudor = variants.find((v) => v.slug === "oudor");

    // Popularity: Riven and Oudor sell best; Bond is the slow one
    const popularity: Record<string, number> = {
      reva: 1.1,
      riven: 1.6,
      maree: 1.0,
      solea: 1.2,
      bond: 0.7,
      oudor: 1.4,
    };

    // Restock 90 days ago, so the demo sales leave believable stock (Riven ends low)
    const restock: Record<string, number> = {
      reva: 70,
      riven: 58,
      maree: 60,
      solea: 70,
      bond: 45,
      oudor: 80,
    };
    const stock = new Map<number, number>();
    const current = await tx
      .select({ id: S.variants.id, stock: S.variants.stock })
      .from(S.variants);
    for (const c of current) stock.set(c.id, c.stock);
    for (const v of variants) {
      const add = restock[v.slug] ?? 40;
      await tx.insert(S.stockMovements).values({
        variantId: v.id,
        type: "manual_adjustment",
        delta: add,
        reason: "Demo restock",
        createdAt: new Date(now - 91 * DAY),
      });
      stock.set(v.id, (stock.get(v.id) ?? 0) + add);
    }

    // Coupons
    const [welcome, eid, freeship, oudorDeal] = await tx
      .insert(S.coupons)
      .values([
        {
          code: "WELCOME10",
          description: "10% off a first order [demo]",
          percentOff: 10,
          maxDiscount: 100_000,
          firstOrderOnly: true,
        },
        {
          code: "EID500",
          description: "৳500 off orders from ৳5,000 [demo]",
          amountOff: 50_000,
          minSubtotal: 500_000,
          usageLimit: 200,
          startsAt: new Date(now - 60 * DAY),
          endsAt: new Date(now + 20 * DAY),
        },
        {
          code: "FREESHIP",
          description: "Free delivery [demo]",
          freeShipping: true,
          perCustomerLimit: 1,
        },
        {
          code: "OUDOR15",
          description: "15% off Oudor [demo]",
          percentOff: 15,
          maxDiscount: 120_000,
          fragranceIds: oudor ? [oudor.fragranceId] : [],
        },
        {
          code: "SUMMER20",
          description: "Ended summer offer [demo]",
          percentOff: 20,
          active: false,
          endsAt: new Date(now - 40 * DAY),
        },
      ])
      .returning();

    // Customers
    const customers: { id: number; name: string; phone: string; email: string; orders: number }[] =
      [];
    const usedPhones = new Set<string>();
    for (let i = 0; i < 70; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      let phone = "";
      do
        phone = `01${pick(["3", "5", "6", "7", "8", "9"])}${String(int(0, 99_999_999)).padStart(8, "0")}`;
      while (usedPhones.has(phone));
      usedPhones.add(phone);
      const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${i}@demo.zalfi.test`;
      const [c] = await tx
        .insert(S.customers)
        .values({ name, phone, email, createdAt: new Date(now - 95 * DAY) })
        .returning({ id: S.customers.id });
      customers.push({ id: c!.id, name, phone, email, orders: 0 });
    }

    // Order times: more recent days busier (the shop is growing), Fridays and evenings busiest
    const times: number[] = [];
    for (let d = 89; d >= 0; d--) {
      const day = now - d * DAY;
      const dow = new Date(day + 6 * 3600_000).getUTCDay();
      const growth = 1 + (89 - d) / 60;
      const n = Math.round((0.8 + rnd() * 1.3) * growth * (dow === 5 ? 1.5 : 1));
      for (let k = 0; k < n; k++) {
        // Dhaka 10:00–23:00 → UTC 04:00–17:00
        const dhakaMidnightUtc = Math.floor((day + 6 * 3600_000) / DAY) * DAY - 6 * 3600_000;
        const hour = weighted<number>([
          [10, 1],
          [12, 2],
          [14, 2],
          [17, 3],
          [19, 4],
          [21, 4],
          [22, 2],
        ]);
        const t = dhakaMidnightUtc + (hour + rnd()) * 3600_000;
        if (t < now - 20 * 60_000) times.push(t);
      }
    }
    times.sort((a, b) => a - b);

    const shipping = { inside: 7_000, outside: 20_000 };
    let created = 0;

    for (const [i, t] of times.entries()) {
      const createdAt = new Date(t);
      const ageDays = (now - t) / DAY;
      const cust =
        chance(0.35) && customers.some((c) => c.orders > 0)
          ? pick(customers.filter((c) => c.orders > 0))
          : pick(customers);
      const inside = chance(0.56);
      const district = inside ? "Dhaka" : chance(0.7) ? pick(BIG_CITIES) : pick(OTHER_DISTRICTS);
      const area = inside ? pick(DHAKA_CITY_THANAS) : `${district} Sadar`;
      const street = `${pick(ROADS)}, ${area}`;
      const method: "sslcommerz" | "cod" = chance(0.72) ? "sslcommerz" : "cod";

      // Items
      const lines: { v: (typeof variants)[number]; qty: number }[] = [];
      const nLines = weighted<number>([
        [1, 70],
        [2, 24],
        [3, 6],
      ]);
      for (let l = 0; l < nLines; l++) {
        const v = weighted(variants.map((x) => [x, popularity[x.slug] ?? 1] as [typeof x, number]));
        if (lines.some((x) => x.v.id === v.id)) continue;
        lines.push({ v, qty: chance(0.12) ? 2 : 1 });
      }
      const subtotal = lines.reduce((s, l) => s + l.v.price * l.qty, 0);

      // Coupon
      let coupon: typeof welcome | null = null;
      let discount = 0;
      let freeShipping = false;
      const roll = rnd();
      if (roll < 0.08 && cust.orders === 0) {
        coupon = welcome!;
        discount = Math.min(Math.round(subtotal * 0.1), 100_000);
      } else if (roll < 0.15 && subtotal >= 500_000 && ageDays < 60) {
        coupon = eid!;
        discount = 50_000;
      } else if (roll < 0.2) {
        coupon = freeship!;
        freeShipping = true;
      } else if (roll < 0.25 && oudor && lines.some((l) => l.v.id === oudor.id)) {
        coupon = oudorDeal!;
        const base = lines
          .filter((l) => l.v.id === oudor.id)
          .reduce((s, l) => s + l.v.price * l.qty, 0);
        discount = Math.min(Math.round(base * 0.15), 120_000);
      }
      const shippingFee = freeShipping ? 0 : inside ? shipping.inside : shipping.outside;
      const total = subtotal - discount + shippingFee;

      // Where this order is now, by age
      let status: Status;
      if (ageDays < 0.05 && method === "sslcommerz") status = "pending_payment";
      else if (ageDays < 1)
        status = weighted<Status>([
          ["confirmed", 5],
          ["packed", 2],
          ["pending_payment", method === "sslcommerz" ? 1 : 0],
        ]);
      else if (ageDays < 3)
        status = weighted<Status>([
          ["packed", 2],
          ["shipped", 4],
          ["out_for_delivery", 2],
          ["cancelled", 0.4],
        ]);
      else if (ageDays < 6)
        status = weighted<Status>([
          ["shipped", 1],
          ["out_for_delivery", 1],
          ["delivered", 6],
          ["delivery_failed", 0.4],
          ["cancelled", 0.4],
        ]);
      else
        status = weighted<Status>([
          ["delivered", 88],
          ["cancelled", 6],
          ["returned", 3],
          ["delivery_failed", 1],
          ["return_requested", ageDays < 15 ? 1 : 0],
        ]);
      // Unpaid online orders that lapsed are cancelled with nothing deducted
      const lapsed = method === "sslcommerz" && status === "cancelled" && chance(0.5);

      const step = (h: number) => new Date(t + h * 3600_000);
      const ts: Partial<Record<string, Date>> = {};
      const reached = (s: Status) => {
        const order: Status[] = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
        const idx = order.indexOf(status);
        const sIdx = order.indexOf(s);
        if (idx >= 0) return sIdx <= idx;
        if (status === "returned" || status === "return_requested") return true;
        if (status === "delivery_failed") return sIdx <= order.indexOf("out_for_delivery");
        if (status === "cancelled") return !lapsed && sIdx === 0;
        return false;
      };
      if (status !== "pending_payment" && !lapsed)
        ts.confirmedAt = step(method === "sslcommerz" ? 0.05 : 0.02);
      if (reached("packed")) ts.packedAt = step(int(3, 20));
      if (reached("shipped")) ts.shippedAt = step(int(20, 30));
      if (reached("out_for_delivery"))
        ts.outForDeliveryAt = step(inside ? int(30, 44) : int(48, 70));
      if (reached("delivered")) ts.deliveredAt = step(inside ? int(36, 50) : int(60, 90));
      if (status === "cancelled") ts.cancelledAt = step(lapsed ? 0.5 : int(1, 10));
      if (status === "delivery_failed") ts.deliveryFailedAt = step(int(40, 80));
      if (status === "return_requested" || status === "returned")
        ts.returnRequestedAt = step(int(80, 140));
      if (status === "returned") ts.returnedAt = step(int(150, 220));

      const paid =
        (method === "sslcommerz" && status !== "pending_payment" && !lapsed) ||
        (method === "cod" && !!ts.deliveredAt);
      const paymentStatus =
        status === "returned" && paid
          ? chance(0.7)
            ? "refunded"
            : "partially_refunded"
          : status === "cancelled" && method === "sslcommerz" && paid
            ? "refunded"
            : paid
              ? "paid"
              : lapsed
                ? "failed"
                : "unpaid";

      const [order] = await tx
        .insert(S.orders)
        .values({
          idempotencyKey: `demo-${i}-${randomBytes(4).toString("hex")}`,
          accessToken: randomBytes(18).toString("base64url"),
          customerId: cust.id,
          customerName: cust.name,
          customerPhone: cust.phone,
          customerEmail: cust.email,
          addressDistrict: district,
          addressArea: area,
          addressStreet: street,
          zone: inside ? "inside_dhaka" : "outside_dhaka",
          subtotal,
          discount,
          shippingFee,
          total,
          couponId: coupon?.id ?? null,
          couponCode: coupon?.code ?? null,
          paymentMethod: method,
          paymentStatus,
          status,
          courier: ts.shippedAt
            ? weighted<"pathao" | "steadfast" | "mock">([
                ["pathao", 5],
                ["steadfast", 4],
                ["mock", 1],
              ])
            : null,
          expiresAt: status === "pending_payment" ? new Date(t + 30 * 60_000) : null,
          receiptSentAt: ts.confirmedAt ?? null,
          createdAt,
          updatedAt: createdAt,
          ...ts,
        })
        .returning({ id: S.orders.id, number: S.orders.number, courier: S.orders.courier });
      cust.orders++;
      created++;

      await tx.insert(S.orderItems).values(
        lines.map((l) => ({
          orderId: order!.id,
          variantId: l.v.id,
          fragranceId: l.v.fragranceId,
          sku: l.v.sku,
          name: l.v.name,
          sizeMl: l.v.sizeMl,
          unitPrice: l.v.price,
          qty: l.qty,
          lineTotal: l.v.price * l.qty,
        })),
      );

      // Stock: a confirmed sale deducts; a cancellation after confirming, or a restocked return, adds back
      if (status === "pending_payment") {
        await tx.insert(S.stockReservations).values(
          lines.map((l) => ({
            orderId: order!.id,
            variantId: l.v.id,
            qty: l.qty,
            expiresAt: new Date(t + 30 * 60_000),
            createdAt,
          })),
        );
      } else if (!lapsed) {
        for (const l of lines) {
          const have = stock.get(l.v.id) ?? 0;
          const qty = Math.min(l.qty, have);
          if (qty <= 0) continue;
          stock.set(l.v.id, have - qty);
          await tx.insert(S.stockMovements).values({
            variantId: l.v.id,
            type: "sale",
            delta: -qty,
            reason: `Order ${order!.number}`,
            orderId: order!.id,
            createdAt: ts.confirmedAt!,
          });
          if (status === "cancelled" || (status === "returned" && chance(0.8))) {
            stock.set(l.v.id, (stock.get(l.v.id) ?? 0) + qty);
            await tx.insert(S.stockMovements).values({
              variantId: l.v.id,
              type: status === "cancelled" ? "cancel_restock" : "return_restock",
              delta: qty,
              reason: `Order ${order!.number}`,
              orderId: order!.id,
              createdAt: ts.cancelledAt ?? ts.returnedAt!,
            });
          }
        }
      }

      // Payments
      let paymentId: number | null = null;
      if (method === "sslcommerz") {
        const [p] = await tx
          .insert(S.payments)
          .values({
            orderId: order!.id,
            provider: "mock",
            tranId: `DEMO${order!.id}${randomBytes(3).toString("hex").toUpperCase()}`,
            valId: paid ? `VAL${randomBytes(5).toString("hex")}` : null,
            amount: total,
            status:
              status === "pending_payment"
                ? "initiated"
                : lapsed
                  ? chance(0.5)
                    ? "failed"
                    : "cancelled"
                  : "paid",
            methodReported: paid ? pick(METHODS) : null,
            validation: paid
              ? { status: "VALID", amount: total / 100, currency: "BDT", demo: true }
              : null,
            createdAt,
            updatedAt: ts.confirmedAt ?? createdAt,
          })
          .returning({ id: S.payments.id });
        paymentId = p!.id;
      }
      // Cash on delivery has no payment record: delivery marks the order paid (as the shop does)

      // Refunds and returns
      if (paymentStatus === "refunded" || paymentStatus === "partially_refunded") {
        const amount = paymentStatus === "refunded" ? total : Math.round(total / 2);
        await tx.insert(S.refunds).values({
          orderId: order!.id,
          paymentId,
          amount,
          reason: status === "cancelled" ? "Cancelled after payment" : "Returned bottle",
          status: "completed",
          createdAt: ts.returnedAt ?? ts.cancelledAt ?? createdAt,
        });
      }

      // Shipments
      if (ts.shippedAt && order!.courier) {
        const code = `${order!.courier === "pathao" ? "DP" : order!.courier === "steadfast" ? "SF" : "MK"}${randomBytes(4).toString("hex").toUpperCase()}`;
        // Each courier's own word for where the parcel is (see src/server/shipping/status-*.ts)
        const stage =
          status === "delivered" || status === "return_requested"
            ? "delivered"
            : status === "returned"
              ? "returned"
              : status === "delivery_failed"
                ? "failed"
                : status === "out_for_delivery"
                  ? "out"
                  : "transit";
        const shipStatus =
          DEMO_COURIER_STATUS[order!.courier as keyof typeof DEMO_COURIER_STATUS][stage];
        await tx.insert(S.shipments).values({
          orderId: order!.id,
          courier: order!.courier,
          consignmentId: code,
          trackingCode: code,
          status: shipStatus,
          codAmount: method === "cod" ? total : 0,
          attempts: status === "delivery_failed" ? int(1, 3) : ts.deliveredAt ? 1 : 0,
          active: !mapStatus(order!.courier, shipStatus).final,
          createdAt: ts.shippedAt,
          updatedAt: ts.deliveredAt ?? ts.deliveryFailedAt ?? ts.outForDeliveryAt ?? ts.shippedAt,
          lastCheckedAt:
            ts.returnedAt ??
            ts.deliveredAt ??
            ts.deliveryFailedAt ??
            ts.outForDeliveryAt ??
            ts.shippedAt,
        });
        await tx.update(S.orders).set({ trackingCode: code }).where(eq(S.orders.id, order!.id));
      }

      // Timeline
      const events: (typeof S.orderEvents.$inferInsert)[] = [
        {
          orderId: order!.id,
          type: "created",
          toStatus: "pending_payment",
          message: `Order placed (${method === "cod" ? "Cash on Delivery" : "online payment"})`,
          actor: "customer",
          createdAt,
        },
      ];
      if (ts.confirmedAt)
        events.push({
          orderId: order!.id,
          type: "status",
          fromStatus: "pending_payment",
          toStatus: "confirmed",
          message: method === "cod" ? "Confirmed (Cash on Delivery)" : "Payment received",
          actor: method === "cod" ? "system" : "payment",
          createdAt: ts.confirmedAt,
        });
      if (ts.packedAt)
        events.push({
          orderId: order!.id,
          type: "status",
          fromStatus: "confirmed",
          toStatus: "packed",
          message: "Packed",
          actor: "system",
          createdAt: ts.packedAt,
        });
      if (ts.shippedAt)
        events.push({
          orderId: order!.id,
          type: "status",
          fromStatus: "packed",
          toStatus: "shipped",
          message: `Handed to ${order!.courier}`,
          actor: "system",
          createdAt: ts.shippedAt,
        });
      if (ts.outForDeliveryAt)
        events.push({
          orderId: order!.id,
          type: "courier",
          fromStatus: "shipped",
          toStatus: "out_for_delivery",
          message: "Out for delivery",
          actor: "courier",
          createdAt: ts.outForDeliveryAt,
        });
      if (ts.deliveredAt)
        events.push({
          orderId: order!.id,
          type: "courier",
          fromStatus: "out_for_delivery",
          toStatus: "delivered",
          message: "Delivered",
          actor: "courier",
          createdAt: ts.deliveredAt,
        });
      if (ts.deliveryFailedAt)
        events.push({
          orderId: order!.id,
          type: "courier",
          fromStatus: "out_for_delivery",
          toStatus: "delivery_failed",
          message: "Customer unreachable",
          actor: "courier",
          createdAt: ts.deliveryFailedAt,
        });
      if (ts.cancelledAt)
        events.push({
          orderId: order!.id,
          type: "status",
          toStatus: "cancelled",
          message: lapsed ? "Payment not completed in time" : "Cancelled at the customer's request",
          actor: lapsed ? "system" : "system",
          createdAt: ts.cancelledAt,
        });
      if (ts.returnRequestedAt)
        events.push({
          orderId: order!.id,
          type: "status",
          fromStatus: "delivered",
          toStatus: "return_requested",
          message: "Return requested",
          actor: "system",
          createdAt: ts.returnRequestedAt,
        });
      if (ts.returnedAt)
        events.push({
          orderId: order!.id,
          type: "status",
          fromStatus: "return_requested",
          toStatus: "returned",
          message: "Returned",
          actor: "system",
          createdAt: ts.returnedAt,
        });
      await tx.insert(S.orderEvents).values(events);
    }

    // Stock now equals the ledger
    await tx.execute(sql`
      update variants v set stock = coalesce((select sum(m.delta) from stock_movements m where m.variant_id = v.id), 0)`);

    console.log(`Demo data: ${created} orders, ${customers.length} customers, 5 coupons.`);
  });

  if (args.has("--clear")) console.log("Demo data removed.");
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
