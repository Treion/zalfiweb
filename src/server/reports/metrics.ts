import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { orderItems, orders, payments, shipments, stockMovements, variants } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { listInventory } from "@/server/catalog/inventory";
import { getSettings } from "@/server/settings";
import { effectiveThreshold } from "@/server/catalog/stock";
import type { OrderStatus } from "@/server/orders/state";
import { BUCKET_SQL, bucketKeys, bucketLabel, type Bucket, type Range } from "./range";

/**
 * The numbers behind the overview and the reports. One rule for what counts as a sale:
 *
 *   An order counts from the moment it is placed (by its Dhaka date), unless it is still waiting
 *   for payment, was cancelled, or came back (returned). Its revenue is its total (bottles after
 *   discounts, plus shipping) less any refunds completed on it.
 *
 * So cash-on-delivery orders count the day they're placed, and a refund lowers the day of its
 * order, not the day it was paid back. Revenue by fragrance and by size uses the bottles' own
 * prices before order discounts (a discount belongs to the order, not to one bottle).
 */

/**
 * The order in the row, for correlated subqueries. Written out: drizzle leaves the column
 * unqualified, and inside `(select … from refunds r …)` a bare "id" would mean r.id.
 */
export const ORDER_ID = sql.raw(`"orders"."id"`);

/** The orders that are sales */
export const SOLD = sql`${orders.status} not in ('pending_payment', 'cancelled', 'returned')`;

/** Completed refunds on the order in the row */
export const REFUNDED = sql<number>`coalesce((select sum(r.amount) from refunds r where r.order_id = ${ORDER_ID} and r.status = 'completed'), 0)`;

const placedIn = (from: Date, to: Date): SQL =>
  and(gte(orders.createdAt, from), lt(orders.createdAt, to))!;

/** The bucket an order falls in, in the format bucketKey() writes */
export const bucketSql = (bucket: Bucket, col: SQL | typeof orders.createdAt = orders.createdAt) =>
  sql<string>`to_char(date_trunc(${sql.raw(`'${BUCKET_SQL[bucket]}'`)}, ${col} at time zone 'Asia/Dhaka'), 'YYYY-MM-DD"T"HH24')`;

const n = (v: unknown) => Number(v ?? 0);

export type Totals = { revenue: number; orders: number; bottles: number; aov: number };

export async function totals(from: Date, to: Date, exec: Executor = poolDb()): Promise<Totals> {
  const [r] = await exec
    .select({
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
      gross: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
      bottles: sql<number>`coalesce(sum((select sum(oi.qty) from order_items oi where oi.order_id = ${ORDER_ID})), 0)::int`,
    })
    .from(orders)
    .where(and(SOLD, placedIn(from, to)));
  const count = n(r?.orders);
  return {
    revenue: n(r?.revenue),
    orders: count,
    bottles: n(r?.bottles),
    aov: count ? Math.round(n(r?.gross) / count) : 0,
  };
}

export type SeriesPoint = {
  key: string;
  label: string;
  revenue: number;
  orders: number;
  /** Null where there were no orders (there's no average of nothing) */
  aov: number | null;
  /** The previous period's value at the same position (null when it has fewer buckets) */
  prevRevenue: number | null;
  prevOrders: number | null;
};

async function rawSeries(from: Date, to: Date, bucket: Bucket, exec: Executor) {
  const rows = await exec
    .select({
      key: bucketSql(bucket),
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
      gross: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(and(SOLD, placedIn(from, to)))
    .groupBy(sql`1`);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return bucketKeys(from, to, bucket).map((key) => {
    const r = byKey.get(key);
    const count = n(r?.orders);
    return {
      key,
      revenue: n(r?.revenue),
      orders: count,
      aov: count ? Math.round(n(r?.gross) / count) : null,
    };
  });
}

/** Revenue, orders and average order value per bucket, with the previous period alongside */
export async function series(range: Range, exec: Executor = poolDb()): Promise<SeriesPoint[]> {
  const [now, prev] = await Promise.all([
    rawSeries(range.from, range.to, range.bucket, exec),
    rawSeries(range.prev.from, range.prev.to, range.bucket, exec),
  ]);
  return now.map((p, i) => ({
    ...p,
    label: bucketLabel(p.key, range.bucket),
    prevRevenue: prev[i]?.revenue ?? null,
    prevOrders: prev[i]?.orders ?? null,
  }));
}

/** Every order placed in the period by its status now (waiting, cancelled and returned too) */
export async function byStatus(from: Date, to: Date, exec: Executor = poolDb()) {
  const rows = await exec
    .select({ status: orders.status, orders: sql<number>`count(*)::int` })
    .from(orders)
    .where(placedIn(from, to))
    .groupBy(orders.status);
  return rows.map((r) => ({ status: r.status as OrderStatus, orders: n(r.orders) }));
}

export type Split<K extends string> = { key: K; orders: number; revenue: number };

export async function byMethod(from: Date, to: Date, exec: Executor = poolDb()) {
  const rows = await exec
    .select({
      key: orders.paymentMethod,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
    })
    .from(orders)
    .where(and(SOLD, placedIn(from, to)))
    .groupBy(orders.paymentMethod);
  return rows.map((r) => ({ key: r.key, orders: n(r.orders), revenue: n(r.revenue) }));
}

export async function byZone(from: Date, to: Date, exec: Executor = poolDb()) {
  const rows = await exec
    .select({
      key: orders.zone,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
      shipping: sql<number>`coalesce(sum(${orders.shippingFee}), 0)::bigint`,
    })
    .from(orders)
    .where(and(SOLD, placedIn(from, to)))
    .groupBy(orders.zone);
  return rows.map((r) => ({
    key: r.key,
    orders: n(r.orders),
    revenue: n(r.revenue),
    shipping: n(r.shipping),
  }));
}

export type FragranceSales = {
  fragranceId: number | null;
  name: string;
  bottles: number;
  revenue: number;
  orders: number;
};

/** Bottles and item sales per fragrance (bottle prices before order discounts), best first */
export async function byFragrance(
  from: Date,
  to: Date,
  exec: Executor = poolDb(),
): Promise<FragranceSales[]> {
  const rows = await exec
    .select({
      fragranceId: orderItems.fragranceId,
      name: sql<string>`max(${orderItems.name})`,
      bottles: sql<number>`sum(${orderItems.qty})::int`,
      revenue: sql<number>`sum(${orderItems.lineTotal})::bigint`,
      orders: sql<number>`count(distinct ${orderItems.orderId})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(SOLD, placedIn(from, to)))
    .groupBy(
      orderItems.fragranceId,
      sql`case when ${orderItems.fragranceId} is null then ${orderItems.name} end`,
    )
    .orderBy(sql`4 desc`, sql`3 desc`);
  return rows.map((r) => ({
    fragranceId: r.fragranceId,
    name: r.name,
    bottles: n(r.bottles),
    revenue: n(r.revenue),
    orders: n(r.orders),
  }));
}

export async function bySize(from: Date, to: Date, exec: Executor = poolDb()) {
  const rows = await exec
    .select({
      sizeMl: orderItems.sizeMl,
      bottles: sql<number>`sum(${orderItems.qty})::int`,
      revenue: sql<number>`sum(${orderItems.lineTotal})::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(SOLD, placedIn(from, to)))
    .groupBy(orderItems.sizeMl)
    .orderBy(orderItems.sizeMl);
  return rows.map((r) => ({ sizeMl: r.sizeMl, bottles: n(r.bottles), revenue: n(r.revenue) }));
}

/* ------------------------------------------------------------------------------------------- */
/* Today at a glance: each card now, and at this time yesterday                                  */

export type Glance = { now: number; then: number };

/** Orders waiting to be packed at `at` (confirmed, not yet packed or cancelled) */
const toPackAt = (at: Date) =>
  sql`${orders.confirmedAt} <= ${at} and (${orders.packedAt} is null or ${orders.packedAt} > ${at}) and (${orders.cancelledAt} is null or ${orders.cancelledAt} > ${at})`;

/** Packed orders no courier had at `at` */
const toSendAt = (at: Date) =>
  sql`${orders.packedAt} <= ${at} and (${orders.shippedAt} is null or ${orders.shippedAt} > ${at}) and (${orders.cancelledAt} is null or ${orders.cancelledAt} > ${at}) and not exists (select 1 from ${shipments} s where s.order_id = ${ORDER_ID} and s.created_at <= ${at} and s.consignment_id is not null)`;

/** Orders whose delivery had failed by `at`, with nothing since */
const failedAt = (at: Date) =>
  sql`${orders.deliveryFailedAt} <= ${at} and not (coalesce(${orders.returnedAt}, 'infinity') <= ${at} or coalesce(${orders.deliveredAt}, 'infinity') between ${orders.deliveryFailedAt} and ${at} or coalesce(${orders.shippedAt}, 'infinity') between ${orders.deliveryFailedAt} and ${at})`;

export async function glance(now: Date = new Date(), exec: Executor = poolDb()) {
  const day = 24 * 3600_000;
  const then = new Date(now.getTime() - day);
  const start = new Date(
    Date.parse(
      `${new Date(now.getTime() + 6 * 3600_000).toISOString().slice(0, 10)}T00:00:00+06:00`,
    ),
  );
  const startThen = new Date(start.getTime() - day);
  const count = async (where: SQL) =>
    n(
      (
        await exec
          .select({ n: sql<number>`count(*)::int` })
          .from(orders)
          .where(where)
      )[0]?.n,
    );

  const [today, yesterday, toPack, toPackThen, toSend, toSendThen, failed, failedThen, low] =
    await Promise.all([
      totals(start, now, exec),
      totals(startThen, then, exec),
      count(eq(orders.status, "confirmed")),
      count(toPackAt(then)),
      count(
        sql`${orders.status} = 'packed' and not exists (select 1 from ${shipments} s where s.order_id = ${ORDER_ID} and s.active)`,
      ),
      count(toSendAt(then)),
      count(eq(orders.status, "delivery_failed")),
      count(failedAt(then)),
      lowStockThen(then, exec),
    ]);
  return {
    revenue: { now: today.revenue, then: yesterday.revenue },
    orders: { now: today.orders, then: yesterday.orders },
    toPack: { now: toPack, then: toPackThen },
    toSend: { now: toSend, then: toSendThen },
    lowStock: low,
    failed: { now: failed, then: failedThen },
  } satisfies Record<string, Glance>;
}

/** Low or sold-out sizes now (as the inventory shows them), and at `then` from the stock ledger */
async function lowStockThen(then: Date, exec: Executor): Promise<Glance> {
  const [inv, cfg, past] = await Promise.all([
    listInventory(exec),
    getSettings("inventory", exec),
    exec
      .select({
        id: variants.id,
        stock: sql<number>`${variants.stock} - coalesce((select sum(m.delta) from ${stockMovements} m where m.variant_id = ${variants.id} and m.created_at > ${then}), 0)`,
        own: variants.lowStockThreshold,
      })
      .from(variants)
      .where(eq(variants.active, true)),
  ]);
  const live = inv.filter((r) => r.active && r.published);
  const ids = new Set(live.map((r) => r.variantId));
  return {
    now: live.filter((r) => r.level !== "ok").length,
    then: past.filter(
      (p) => ids.has(p.id) && n(p.stock) <= effectiveThreshold(p.own, cfg.lowStockThreshold),
    ).length,
  };
}

/* ------------------------------------------------------------------------------------------- */
/* Needs attention                                                                               */

export type Attention = {
  kind: "expiring" | "payment_failed" | "delivery_failed" | "return_requested" | "out_of_stock";
  title: string;
  detail: string;
  href: string;
  at: Date | null;
};

/**
 * What someone should look at now: unpaid orders about to lapse (within the hour), online
 * payments that failed in the last day on orders still waiting, failed deliveries, return
 * requests, and sizes on sale that are sold out. Oldest problems first within each kind.
 */
export async function attention(now: Date = new Date(), exec: Executor = poolDb()) {
  const soon = new Date(now.getTime() + 3600_000);
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const pick = {
    id: orders.id,
    number: orders.number,
    name: orders.customerName,
    total: orders.total,
    expiresAt: orders.expiresAt,
    failedAt: orders.deliveryFailedAt,
    updatedAt: orders.updatedAt,
  };
  const [expiring, failedPay, failedDelivery, returns, inv] = await Promise.all([
    exec
      .select(pick)
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending_payment"),
          sql`${orders.paymentStatus} <> 'paid'`,
          gte(orders.expiresAt, now),
          lt(orders.expiresAt, soon),
        ),
      )
      .orderBy(orders.expiresAt)
      .limit(20),
    exec
      .selectDistinctOn([orders.id], { ...pick, payAt: payments.updatedAt })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(
        and(
          eq(payments.status, "failed"),
          gte(payments.updatedAt, dayAgo),
          eq(orders.status, "pending_payment"),
          sql`${orders.paymentStatus} <> 'paid'`,
        ),
      )
      .orderBy(orders.id, sql`${payments.updatedAt} desc`)
      .limit(20),
    exec
      .select(pick)
      .from(orders)
      .where(eq(orders.status, "delivery_failed"))
      .orderBy(orders.deliveryFailedAt)
      .limit(20),
    exec
      .select(pick)
      .from(orders)
      .where(eq(orders.status, "return_requested"))
      .orderBy(orders.updatedAt)
      .limit(20),
    listInventory(exec),
  ]);
  const mins = (d: Date) => Math.max(1, Math.round((d.getTime() - now.getTime()) / 60_000));
  const items: Attention[] = [
    ...expiring.map((o) => ({
      kind: "expiring" as const,
      title: o.number,
      detail: `${o.name}: unpaid, lapses in ${mins(o.expiresAt!)} min`,
      href: `/admin/orders/${o.id}`,
      at: o.expiresAt,
    })),
    ...failedPay.map((o) => ({
      kind: "payment_failed" as const,
      title: o.number,
      detail: `${o.name}: online payment failed`,
      href: `/admin/orders/${o.id}`,
      at: o.payAt,
    })),
    ...failedDelivery.map((o) => ({
      kind: "delivery_failed" as const,
      title: o.number,
      detail: `${o.name}: the courier couldn't deliver`,
      href: `/admin/orders/${o.id}`,
      at: o.failedAt,
    })),
    ...returns.map((o) => ({
      kind: "return_requested" as const,
      title: o.number,
      detail: `${o.name}: asked to return it`,
      href: `/admin/orders/${o.id}`,
      at: o.updatedAt,
    })),
    ...inv
      .filter((r) => r.active && r.published && r.level === "out")
      .map((r) => ({
        kind: "out_of_stock" as const,
        title: `${r.name} ${r.sizeMl} ml`,
        detail: r.reserved ? `Sold out (${r.reserved} held by unpaid orders)` : "Sold out",
        href: "/admin/inventory",
        at: null,
      })),
  ];
  return items;
}
