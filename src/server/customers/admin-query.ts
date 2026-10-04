import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { ListParams } from "@/components/admin/data-table/url-state";
import { customerAddresses, customers, orderItems, orders } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { REFUNDED, SOLD } from "@/server/reports/metrics";

/**
 * Customers, as checkout builds them: one per verified phone number, with the name and email of
 * their latest order. "Spent" follows the revenue rule (reports/metrics.ts): orders that are sales,
 * less refunds. Unpaid, cancelled and returned orders are counted apart, as "placed".
 */

export const CUSTOMER_FILTER_KEYS = ["kind", "days"];
const SORTS = {
  last: sql`s.last_at`,
  spent: sql`coalesce(s.spent, 0)`,
  orders: sql`coalesce(s.orders, 0)`,
  name: customers.name,
  joined: customers.createdAt,
} as const;
export const CUSTOMER_SORT_KEYS = Object.keys(SORTS);

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

/** Per customer: sales, all orders placed, money spent, first and last order */
const stats = (exec: Executor) =>
  exec
    .select({
      customerId: orders.customerId,
      orders: sql<number>`(count(*) filter (where ${SOLD}))::int`.as("orders"),
      placed: sql<number>`count(*)::int`.as("placed"),
      spent:
        sql<number>`(coalesce(sum(${orders.total} - ${REFUNDED}) filter (where ${SOLD}), 0))::bigint`.as(
          "spent",
        ),
      firstAt: sql<Date>`min(${orders.createdAt})`.as("first_at"),
      lastAt: sql<Date>`max(${orders.createdAt})`.as("last_at"),
    })
    .from(orders)
    .groupBy(orders.customerId)
    .as("s");

function customerWhere(p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (p.q) {
    const digits = p.q.replace(/\D/g, "");
    parts.push(
      or(
        ilike(customers.name, like(p.q)),
        ilike(customers.email, like(p.q)),
        digits.length >= 4
          ? ilike(customers.phone, `%${digits.replace(/^880/, "0").replace(/^0?1/, "1")}%`)
          : undefined,
      ),
    );
  }
  const f = p.filters;
  if (f.kind === "repeat") parts.push(sql`coalesce(s.orders, 0) >= 2`);
  if (f.kind === "new") parts.push(sql`coalesce(s.orders, 0) = 1`);
  if (f.kind === "none") parts.push(sql`coalesce(s.orders, 0) = 0`);
  const days = Number(f.days);
  if (days > 0) parts.push(sql`s.last_at >= now() - make_interval(days => ${days})`);
  return parts.length ? and(...parts) : undefined;
}

export async function listCustomersAdmin(
  p: ListParams,
  limit = p.pageSize,
  exec: Executor = poolDb(),
) {
  const s = stats(exec);
  const w = customerWhere(p);
  const col = SORTS[(p.sort ?? "last") as keyof typeof SORTS] ?? SORTS.last;
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        joinedAt: customers.createdAt,
        orders: sql<number>`coalesce(s.orders, 0)::int`,
        placed: sql<number>`coalesce(s.placed, 0)::int`,
        spent: sql<number>`coalesce(s.spent, 0)::bigint`,
        firstAt: sql<Date | null>`s.first_at`,
        lastAt: sql<Date | null>`s.last_at`,
        district: sql<string | null>`coalesce(
          (select a.district from customer_addresses a where a.customer_id = "customers"."id" order by a.created_at desc limit 1),
          (select o.address_district from orders o where o.customer_id = "customers"."id" order by o.created_at desc limit 1))`,
      })
      .from(customers)
      .leftJoin(s, eq(s.customerId, customers.id))
      .where(w)
      .orderBy(
        p.dir === "asc" ? sql`${col} asc nulls first` : sql`${col} desc nulls last`,
        desc(customers.id),
      )
      .limit(limit)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(customers)
      .leftJoin(s, eq(s.customerId, customers.id))
      .where(w),
  ]);
  return {
    rows: rows.map((r) => ({
      ...r,
      spent: Number(r.spent),
      firstAt: r.firstAt ? new Date(r.firstAt) : null,
      lastAt: r.lastAt ? new Date(r.lastAt) : null,
    })),
    total: total?.n ?? 0,
  };
}

export type CustomerListRow = Awaited<ReturnType<typeof listCustomersAdmin>>["rows"][number];

/** One customer: details, addresses, every order, and the fragrances they buy */
export async function getCustomerAdmin(id: number, exec: Executor = poolDb()) {
  const [c] = await exec.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const [addresses, list, favourites] = await Promise.all([
    exec
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, id))
      .orderBy(desc(customerAddresses.createdAt)),
    exec
      .select({
        id: orders.id,
        number: orders.number,
        createdAt: orders.createdAt,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        total: orders.total,
        refunded: sql<number>`${REFUNDED}::bigint`,
        sold: sql<boolean>`${SOLD}`,
        bottles: sql<number>`(select coalesce(sum(oi.qty), 0)::int from order_items oi where oi.order_id = "orders"."id")`,
      })
      .from(orders)
      .where(eq(orders.customerId, id))
      .orderBy(desc(orders.createdAt)),
    exec
      .select({ name: orderItems.name, bottles: sql<number>`sum(${orderItems.qty})::int` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.customerId, id), SOLD))
      .groupBy(orderItems.name)
      .orderBy(sql`2 desc`, orderItems.name)
      .limit(6),
  ]);
  const used = await exec
    .selectDistinctOn([orders.addressStreet, orders.addressArea, orders.addressDistrict], {
      street: orders.addressStreet,
      area: orders.addressArea,
      district: orders.addressDistrict,
      zone: orders.zone,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.customerId, id))
    .orderBy(
      orders.addressStreet,
      orders.addressArea,
      orders.addressDistrict,
      desc(orders.createdAt),
    );
  // Saved addresses, and any used on an order that weren't saved, newest first
  const key = (a: { street: string; area: string; district: string }) =>
    `${a.street}|${a.area}|${a.district}`.toLowerCase();
  const saved = new Set(addresses.map(key));
  const allAddresses = [
    ...addresses.map((a) => ({
      street: a.street,
      area: a.area,
      district: a.district,
      zone: a.zone,
      at: a.createdAt,
    })),
    ...used.filter((a) => !saved.has(key(a))).map((a) => ({ ...a, at: a.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
  const sales = list.filter((o) => o.sold);
  const spent = sales.reduce((n, o) => n + o.total - Number(o.refunded), 0);
  return {
    customer: c,
    addresses: allAddresses,
    orders: list.map((o) => ({ ...o, refunded: Number(o.refunded) })),
    favourites: favourites.map((r) => ({ name: r.name, bottles: Number(r.bottles) })),
    stats: {
      orders: sales.length,
      placed: list.length,
      spent,
      average: sales.length ? Math.round(sales.reduce((n, o) => n + o.total, 0) / sales.length) : 0,
      firstAt: list.at(-1)?.createdAt ?? null,
      lastAt: list[0]?.createdAt ?? null,
    },
  };
}

export type CustomerDetail = NonNullable<Awaited<ReturnType<typeof getCustomerAdmin>>>;
