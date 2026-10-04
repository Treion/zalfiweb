import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { ListParams } from "@/components/admin/data-table/url-state";
import { adminUsers, orderEvents, orderItems, orders } from "@/db/schema";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/checkout";
import { COURIER_NAMES, type CourierName } from "@/server/shipping/types";

/** The order in a correlated subquery (Drizzle leaves a bare "id", which means the subquery's) */
const ORDER_ID = sql.raw(`"orders"."id"`);
import { poolDb, type Executor } from "@/server/db/pool";
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderStatus } from "./state";

/** Filters the Orders list supports (all in the URL) */
export const ORDER_FILTER_KEYS = [
  "status",
  "payment",
  "method",
  "courier",
  "zone",
  "days",
  "coupon",
  "view",
  "check",
];

/** Quick views over the list */
export const ORDER_VIEWS = {
  to_pack: ["confirmed"],
  to_ship: ["packed"],
  in_transit: ["shipped", "out_for_delivery"],
  problems: ["delivery_failed", "return_requested"],
} as const satisfies Record<string, readonly OrderStatus[]>;

function orderWhere(p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = p.q.replace(/\D/g, "");
    parts.push(
      or(
        ilike(orders.number, like),
        ilike(orders.customerName, like),
        ilike(orders.customerEmail, like),
        // 01712-345678, +8801712345678 and 1712345678 all find 01712345678
        digits.length >= 4
          ? ilike(orders.customerPhone, `%${digits.replace(/^880/, "0").replace(/^0?1/, "1")}%`)
          : undefined,
      ),
    );
  }
  const f = p.filters;
  if (f.status && (ORDER_STATUSES as readonly string[]).includes(f.status))
    parts.push(eq(orders.status, f.status as OrderStatus));
  if (f.view && f.view in ORDER_VIEWS)
    parts.push(inArray(orders.status, [...ORDER_VIEWS[f.view as keyof typeof ORDER_VIEWS]]));
  if (f.payment && (PAYMENT_STATUSES as readonly string[]).includes(f.payment))
    parts.push(eq(orders.paymentStatus, f.payment as (typeof PAYMENT_STATUSES)[number]));
  if (f.method && (PAYMENT_METHODS as readonly string[]).includes(f.method))
    parts.push(eq(orders.paymentMethod, f.method as PaymentMethod));
  // bKash or Nagad payments the customer has sent a transaction ID for, waiting for the team
  if (f.check === "1")
    parts.push(
      sql`exists (select 1 from payments p where p.order_id = ${ORDER_ID} and p.provider = 'manual' and p.status = 'initiated')`,
    );
  if (f.courier && (COURIER_NAMES as readonly string[]).includes(f.courier))
    parts.push(eq(orders.courier, f.courier as CourierName));
  if (f.courier === "none") parts.push(sql`${orders.courier} is null`);
  if (f.zone === "inside_dhaka" || f.zone === "outside_dhaka") parts.push(eq(orders.zone, f.zone));
  if (f.coupon === "any") parts.push(sql`${orders.couponCode} is not null`);
  else if (f.coupon) parts.push(sql`upper(${orders.couponCode}) = ${f.coupon.toUpperCase()}`);
  const days = Number(f.days);
  if (days > 0) parts.push(gte(orders.createdAt, sql`now() - make_interval(days => ${days})`));
  if (f.before && /^\d{4}-\d{2}-\d{2}$/.test(f.before))
    parts.push(lt(orders.createdAt, new Date(f.before)));
  return parts.length ? and(...parts) : undefined;
}

const SORTS = { created: orders.createdAt, total: orders.total, number: orders.number } as const;
export const ORDER_SORT_KEYS = Object.keys(SORTS);

export async function listOrdersAdmin(
  p: ListParams,
  limit = p.pageSize,
  exec: Executor = poolDb(),
) {
  const w = orderWhere(p);
  const col = SORTS[(p.sort ?? "created") as keyof typeof SORTS] ?? orders.createdAt;
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        customerEmail: orders.customerEmail,
        district: orders.addressDistrict,
        area: orders.addressArea,
        street: orders.addressStreet,
        zone: orders.zone,
        subtotal: orders.subtotal,
        discount: orders.discount,
        shippingFee: orders.shippingFee,
        total: orders.total,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        couponCode: orders.couponCode,
        courier: orders.courier,
        trackingCode: orders.trackingCode,
        // Written out in full: inside a subquery drizzle leaves column names unqualified
        bottles: sql<number>`(select coalesce(sum(oi.qty), 0)::int from order_items oi where oi.order_id = "orders"."id")`,
      })
      .from(orders)
      .where(w)
      .orderBy(p.dir === "asc" ? asc(col) : desc(col), desc(orders.id))
      .limit(limit)
      .offset((p.page - 1) * p.pageSize),
    exec.select({ n: count() }).from(orders).where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type OrderListRow = Awaited<ReturnType<typeof listOrdersAdmin>>["rows"][number];

/** Orders waiting to be packed (the sidebar badge) */
export async function ordersToPackCount(exec: Executor = poolDb()) {
  const [r] = await exec.select({ n: count() }).from(orders).where(eq(orders.status, "confirmed"));
  return r?.n ?? 0;
}

export async function getOrderAdmin(id: number, exec: Executor = poolDb()) {
  const [order] = await exec.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const [items, events, [history]] = await Promise.all([
    exec.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
    exec
      .select({
        id: orderEvents.id,
        type: orderEvents.type,
        fromStatus: orderEvents.fromStatus,
        toStatus: orderEvents.toStatus,
        message: orderEvents.message,
        actor: orderEvents.actor,
        createdAt: orderEvents.createdAt,
        adminName: adminUsers.name,
      })
      .from(orderEvents)
      .leftJoin(adminUsers, sql`${orderEvents.actor} = 'admin:' || ${adminUsers.id}`)
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.createdAt), desc(orderEvents.id)),
    // This customer's other orders (by phone), cancelled ones excluded
    exec
      .select({
        orders: count(),
        spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.paymentStatus} = 'paid'), 0)::int`,
      })
      .from(orders)
      .where(and(eq(orders.customerPhone, order.customerPhone), ne(orders.status, "cancelled"))),
  ]);
  return {
    order,
    items,
    events,
    customer: { orders: history?.orders ?? 0, spent: Number(history?.spent ?? 0) },
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderAdmin>>>;
