import { and, asc, count, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { ListParams } from "@/components/admin/data-table/url-state";
import { adminUsers, orders, returns, shipments } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { ORDER_STATUSES, type OrderStatus } from "@/server/orders/state";
import { CANCELLED_HERE, type CourierName } from "./types";

/** The Shipping page: parcels by courier and state, failed deliveries, returns, cash on delivery */

export const SHIPPING_VIEWS = ["on_the_way", "failed", "all", "returns"] as const;
export type ShippingView = (typeof SHIPPING_VIEWS)[number];
export const SHIPMENT_FILTER_KEYS = ["courier", "status", "view", "days"];

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;
const COURIERS: CourierName[] = ["mock", "pathao", "steadfast"];
/** Delivered, as far as the cash goes (a return asked for after delivery was still paid for) */
const DELIVERED: OrderStatus[] = ["delivered", "return_requested"];

/** The order's latest parcel (a failed one may be back with ZALFI, and so no longer active) */
const latest = sql`${shipments.id} = (select max(s2.id) from shipments s2 where s2.order_id = ${shipments.orderId} and s2.status not in ('creating', ${CANCELLED_HERE}))`;

function search(q: string) {
  const digits = q.replace(/\D/g, "");
  return or(
    ilike(orders.number, like(q)),
    ilike(orders.customerName, like(q)),
    ilike(shipments.consignmentId, like(q)),
    ilike(shipments.trackingCode, like(q)),
    digits.length >= 4
      ? ilike(orders.customerPhone, `%${digits.replace(/^880/, "0").replace(/^0?1/, "1")}%`)
      : undefined,
  );
}

function shipmentWhere(view: ShippingView, p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [sql`${shipments.status} <> 'creating'`];
  if (view === "on_the_way") parts.push(eq(shipments.active, true));
  if (view === "failed") parts.push(eq(orders.status, "delivery_failed"), latest);
  if (p.q) parts.push(search(p.q));
  const f = p.filters;
  if (f.courier && COURIERS.includes(f.courier as CourierName))
    parts.push(eq(shipments.courier, f.courier as CourierName));
  if (f.status && (ORDER_STATUSES as readonly string[]).includes(f.status))
    parts.push(eq(orders.status, f.status as OrderStatus));
  const days = Number(f.days);
  if (days > 0) parts.push(gte(shipments.createdAt, sql`now() - make_interval(days => ${days})`));
  return and(...parts);
}

export async function listShipmentsAdmin(
  view: ShippingView,
  p: ListParams,
  exec: Executor = poolDb(),
) {
  const w = shipmentWhere(view, p);
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: shipments.id,
        courier: shipments.courier,
        consignmentId: shipments.consignmentId,
        trackingCode: shipments.trackingCode,
        status: shipments.status,
        codAmount: shipments.codAmount,
        attempts: shipments.attempts,
        active: shipments.active,
        lastCheckedAt: shipments.lastCheckedAt,
        createdAt: shipments.createdAt,
        orderId: orders.id,
        orderNumber: orders.number,
        orderStatus: orders.status,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        district: orders.addressDistrict,
      })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(w)
      .orderBy(
        p.dir === "asc" ? asc(shipments.createdAt) : desc(shipments.createdAt),
        desc(shipments.id),
      )
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type ShipmentListRow = Awaited<ReturnType<typeof listShipmentsAdmin>>["rows"][number];

export async function listReturnsAdmin(p: ListParams, exec: Executor = poolDb()) {
  const parts: (SQL | undefined)[] = [];
  if (p.q)
    parts.push(
      or(
        ilike(orders.number, like(p.q)),
        ilike(orders.customerName, like(p.q)),
        ilike(returns.reason, like(p.q)),
      ),
    );
  const days = Number(p.filters.days);
  if (days > 0) parts.push(gte(returns.createdAt, sql`now() - make_interval(days => ${days})`));
  const w = parts.length ? and(...parts) : undefined;
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: returns.id,
        createdAt: returns.createdAt,
        reason: returns.reason,
        condition: returns.condition,
        restocked: returns.restocked,
        bottles: sql<number>`(select coalesce(sum((x->>'qty')::int), 0)::int from jsonb_array_elements(${returns.items}) x)`,
        orderId: orders.id,
        orderNumber: orders.number,
        customerName: orders.customerName,
        total: orders.total,
        paymentMethod: orders.paymentMethod,
        adminName: adminUsers.name,
      })
      .from(returns)
      .innerJoin(orders, eq(orders.id, returns.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, returns.createdBy))
      .where(w)
      .orderBy(desc(returns.createdAt), desc(returns.id))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(returns)
      .innerJoin(orders, eq(orders.id, returns.orderId))
      .where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type ReturnListRow = Awaited<ReturnType<typeof listReturnsAdmin>>["rows"][number];

/**
 * Per courier: parcels on the way and the cash still to collect on them; parcels delivered in the
 * last `days` and the cash the courier collected for them (what it owes ZALFI before its payout);
 * failed deliveries waiting on a decision, and parcels returned.
 */
export async function courierSummary(days = 30, exec: Executor = poolDb()) {
  const since = sql`now() - make_interval(days => ${days})`;
  const live = and(
    sql`${shipments.status} not in ('creating', ${CANCELLED_HERE})`,
    sql`${shipments.consignmentId} is not null`,
  );
  const rows = await exec
    .select({
      courier: shipments.courier,
      onTheWay: sql<number>`count(*) filter (where ${shipments.active})::int`,
      toCollect: sql<number>`coalesce(sum(${shipments.codAmount}) filter (where ${shipments.active}), 0)::bigint`,
      delivered: sql<number>`count(*) filter (where ${inArray(orders.status, DELIVERED)} and ${orders.deliveredAt} >= ${since})::int`,
      collected: sql<number>`coalesce(sum(${shipments.codAmount}) filter (where ${inArray(orders.status, DELIVERED)} and ${orders.deliveredAt} >= ${since}), 0)::bigint`,
      failed: sql<number>`count(*) filter (where ${orders.status} = 'delivery_failed' and ${latest})::int`,
      returned: sql<number>`count(*) filter (where ${orders.status} = 'returned' and ${orders.returnedAt} >= ${since})::int`,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(live)
    .groupBy(shipments.courier);
  return rows.map((r) => ({
    ...r,
    toCollect: Number(r.toCollect),
    collected: Number(r.collected),
  }));
}

export type CourierSummary = Awaited<ReturnType<typeof courierSummary>>[number];
