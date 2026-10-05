import { sizeLabel } from "@/lib/size";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { adminUsers, coupons, orderItems, orders, refunds, returns } from "@/db/schema";
import { listInventory } from "@/server/catalog/inventory";
import { poolDb, type Executor } from "@/server/db/pool";
import { RETURN_CONDITION_LABELS, type ReturnCondition } from "@/server/shipping/returns-meta";
import { ORDER_ID, REFUNDED, SOLD, bucketSql } from "./metrics";
import { bucketKeys, bucketLabel, type Bucket, type Range } from "./range";

/**
 * The Reports page. Each report is one function returning its table (columns typed, values raw)
 * and the series its chart draws; the page and the CSV export both read it, so they always agree.
 * Money columns are marked, and left out for managers who may not see revenue.
 *
 * Sales, products, sizes, coupons and zones follow the revenue rule in metrics.ts (orders by the
 * day they were placed). Refunds and returns are dated by when they happened.
 */

export const REPORT_KEYS = [
  "sales",
  "products",
  "sizes",
  "inventory",
  "coupons",
  "zones",
  "refunds",
] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];

export const REPORT_LABELS: Record<ReportKey, string> = {
  sales: "Sales",
  products: "Fragrances",
  sizes: "Sizes",
  inventory: "Stock value",
  coupons: "Coupons",
  zones: "Zones",
  refunds: "Refunds & returns",
};

export type ColumnKind = "text" | "count" | "taka" | "percent" | "date" | "days";
export type Column = { key: string; label: string; kind: ColumnKind; money?: boolean };
export type Row = Record<string, string | number | Date | null>;
export type Table = { columns: Column[]; rows: Row[]; totals?: Row };
export type ChartPoint = { key: string; label: string; value: number };
export type Report = {
  key: ReportKey;
  title: string;
  description: string;
  tables: { id: string; title?: string; table: Table }[];
  chart?: { kind: "time" | "bars" | "split"; title: string; money: boolean; points: ChartPoint[] };
  /** The period is ignored (stock is now) */
  timeless?: boolean;
};

const n = (v: unknown) => Number(v ?? 0);
const placedIn = (r: Range) => and(gte(orders.createdAt, r.from), lt(orders.createdAt, r.to))!;
const share = (part: number, whole: number) => (whole ? part / whole : 0);

/** Drops the money columns (and chart) when revenue is hidden */
export function forViewer(report: Report, money: boolean): Report {
  if (money) return report;
  const strip = (t: Table): Table => {
    const columns = t.columns.filter((c) => !c.money);
    const keep = new Set(columns.map((c) => c.key));
    const pick = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k)));
    return { columns, rows: t.rows.map(pick), totals: t.totals && pick(t.totals) };
  };
  return {
    ...report,
    tables: report.tables.map((x) => ({ ...x, table: strip(x.table) })),
    chart: report.chart?.money ? undefined : report.chart,
  };
}

/* ------------------------------------------------------------------------------------------- */

/** Day, week or month rows: orders, bottles, item sales, discounts, shipping, refunds, revenue */
async function sales(range: Range, by: Bucket, exec: Executor): Promise<Report> {
  const unit = by === "hour" ? "day" : by;
  const rows = await exec
    .select({
      key: bucketSql(unit),
      orders: sql<number>`count(*)::int`,
      bottles: sql<number>`coalesce(sum((select sum(oi.qty) from order_items oi where oi.order_id = ${ORDER_ID})), 0)::int`,
      items: sql<number>`coalesce(sum(${orders.subtotal}), 0)::bigint`,
      discounts: sql<number>`coalesce(sum(${orders.discount}), 0)::bigint`,
      shipping: sql<number>`coalesce(sum(${orders.shippingFee}), 0)::bigint`,
      refunds: sql<number>`coalesce(sum(${REFUNDED}), 0)::bigint`,
      gross: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
    })
    .from(orders)
    .where(and(SOLD, placedIn(range)))
    .groupBy(sql`1`);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const table: Row[] = bucketKeys(range.from, range.to, unit).map((key) => {
    const r = byKey.get(key);
    const count = n(r?.orders);
    return {
      period: bucketLabel(key, unit),
      orders: count,
      bottles: n(r?.bottles),
      items: n(r?.items),
      discounts: n(r?.discounts),
      shipping: n(r?.shipping),
      refunds: n(r?.refunds),
      revenue: n(r?.gross) - n(r?.refunds),
      aov: count ? Math.round(n(r?.gross) / count) : null,
    };
  });
  const sum = (k: string) => table.reduce((s, r) => s + n(r[k]), 0);
  const orderCount = sum("orders");
  return {
    key: "sales",
    title: "Sales",
    description:
      "Orders placed that count as sales: item sales less discounts, plus shipping, less refunds, gives revenue. Cancelled and returned orders are left out whole, refunds and all (see Refunds & returns).",
    chart: {
      kind: "time",
      title: "Revenue",
      money: true,
      points: table.map((r, i) => ({
        key: String(i),
        label: String(r.period),
        value: n(r.revenue),
      })),
    },
    tables: [
      {
        id: "sales",
        table: {
          columns: [
            {
              key: "period",
              label: unit === "day" ? "Day" : unit === "week" ? "Week" : "Month",
              kind: "text",
            },
            { key: "orders", label: "Orders", kind: "count" },
            { key: "bottles", label: "Bottles", kind: "count" },
            { key: "items", label: "Item sales", kind: "taka", money: true },
            { key: "discounts", label: "Discounts", kind: "taka", money: true },
            { key: "shipping", label: "Shipping", kind: "taka", money: true },
            { key: "refunds", label: "Refunds", kind: "taka", money: true },
            { key: "revenue", label: "Revenue", kind: "taka", money: true },
            { key: "aov", label: "Average order", kind: "taka", money: true },
          ],
          rows: table,
          totals: {
            period: "Total",
            orders: orderCount,
            bottles: sum("bottles"),
            items: sum("items"),
            discounts: sum("discounts"),
            shipping: sum("shipping"),
            refunds: sum("refunds"),
            revenue: sum("revenue"),
            aov: orderCount ? Math.round((sum("revenue") + sum("refunds")) / orderCount) : null,
          },
        },
      },
    ],
  };
}

/** Per fragrance: bottles, orders, item sales, share, average bottle price, bottles returned */
async function products(range: Range, exec: Executor): Promise<Report> {
  const [sold, back] = await Promise.all([
    exec
      .select({
        id: orderItems.fragranceId,
        setId: orderItems.setId,
        name: sql<string>`max(${orderItems.name})`,
        bottles: sql<number>`sum(${orderItems.qty})::int`,
        orders: sql<number>`count(distinct ${orderItems.orderId})::int`,
        items: sql<number>`sum(${orderItems.lineTotal})::bigint`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(SOLD, placedIn(range)))
      .groupBy(
        orderItems.fragranceId,
        orderItems.setId,
        sql`case when ${orderItems.fragranceId} is null and ${orderItems.setId} is null then ${orderItems.name} end`,
      ),
    exec
      .select({
        id: orderItems.fragranceId,
        setId: orderItems.setId,
        name: sql<string>`max(${orderItems.name})`,
        bottles: sql<number>`sum(${orderItems.qty})::int`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(and(eq(orders.status, "returned"), placedIn(range)))
      .groupBy(
        orderItems.fragranceId,
        orderItems.setId,
        sql`case when ${orderItems.fragranceId} is null and ${orderItems.setId} is null then ${orderItems.name} end`,
      ),
  ]);
  const total = sold.reduce((s, r) => s + n(r.items), 0);
  const keyOf = (r: { id: number | null; setId: number | null; name: string }) =>
    r.id != null ? `#${r.id}` : r.setId != null ? `set#${r.setId}` : r.name;
  const returned = new Map(back.map((r) => [keyOf(r), n(r.bottles)]));
  const rows = sold
    .map((r) => ({
      fragrance: r.name,
      bottles: n(r.bottles),
      orders: n(r.orders),
      items: n(r.items),
      share: share(n(r.items), total),
      price: n(r.bottles) ? Math.round(n(r.items) / n(r.bottles)) : null,
      returned: returned.get(keyOf(r)) ?? 0,
    }))
    .sort((a, b) => b.items - a.items || b.bottles - a.bottles);
  return {
    key: "products",
    title: "Fragrances",
    description:
      "Bottles sold per fragrance, at bottle prices before order discounts. A discovery set is its own row and counts one per box. Returned bottles are from orders placed in the period that came back.",
    chart: {
      kind: "bars",
      title: "Item sales by fragrance",
      money: true,
      points: rows.map((r) => ({ key: r.fragrance, label: r.fragrance, value: r.items })),
    },
    tables: [
      {
        id: "products",
        table: {
          columns: [
            { key: "fragrance", label: "Fragrance", kind: "text" },
            { key: "bottles", label: "Bottles", kind: "count" },
            { key: "orders", label: "Orders", kind: "count" },
            { key: "items", label: "Item sales", kind: "taka", money: true },
            { key: "share", label: "Share", kind: "percent", money: true },
            { key: "price", label: "Per bottle", kind: "taka", money: true },
            { key: "returned", label: "Returned", kind: "count" },
          ],
          rows,
          totals: {
            fragrance: "Total",
            bottles: rows.reduce((s, r) => s + r.bottles, 0),
            orders: null,
            items: total,
            share: total ? 1 : 0,
            price: null,
            returned: rows.reduce((s, r) => s + r.returned, 0),
          },
        },
      },
    ],
  };
}

async function sizes(range: Range, exec: Executor): Promise<Report> {
  const rows = await exec
    .select({
      size: orderItems.sizeMl,
      pieces: orderItems.pieces,
      bottles: sql<number>`sum(${orderItems.qty})::int`,
      orders: sql<number>`count(distinct ${orderItems.orderId})::int`,
      items: sql<number>`sum(${orderItems.lineTotal})::bigint`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(SOLD, placedIn(range)))
    .groupBy(orderItems.sizeMl, orderItems.pieces)
    .orderBy(orderItems.pieces, desc(orderItems.sizeMl));
  const bottles = rows.reduce((s, r) => s + n(r.bottles), 0);
  const items = rows.reduce((s, r) => s + n(r.items), 0);
  const table = rows.map((r) => ({
    size: sizeLabel(r.size, r.pieces),
    bottles: n(r.bottles),
    bottleShare: share(n(r.bottles), bottles),
    orders: n(r.orders),
    items: n(r.items),
    price: n(r.bottles) ? Math.round(n(r.items) / n(r.bottles)) : null,
  }));
  return {
    key: "sizes",
    title: "Sizes",
    description:
      "Bottles sold per size: 50 ml bottles, and discovery sets (3 × 3 ml) counted one per box. Another size shows here as soon as it sells.",
    chart: {
      kind: "split",
      title: "Bottles by size",
      money: false,
      points: table.map((r) => ({ key: r.size, label: r.size, value: r.bottles })),
    },
    tables: [
      {
        id: "sizes",
        table: {
          columns: [
            { key: "size", label: "Size", kind: "text" },
            { key: "bottles", label: "Bottles", kind: "count" },
            { key: "bottleShare", label: "Share", kind: "percent" },
            { key: "orders", label: "Orders", kind: "count" },
            { key: "items", label: "Item sales", kind: "taka", money: true },
            { key: "price", label: "Per bottle", kind: "taka", money: true },
          ],
          rows: table,
          totals: {
            size: "Total",
            bottles,
            bottleShare: bottles ? 1 : 0,
            orders: null,
            items,
            price: null,
          },
        },
      },
    ],
  };
}

/** Every size's stock now, valued at shop prices (cost prices aren't recorded) */
async function inventory(exec: Executor): Promise<Report> {
  const inv = await listInventory(exec);
  const rows = inv.map((r) => ({
    fragrance: r.name,
    size: sizeLabel(r.sizeMl, r.pieces),
    sku: r.sku,
    state:
      !r.active || !r.published
        ? "Not on sale"
        : r.level === "out"
          ? "Sold out"
          : r.level === "low"
            ? "Low"
            : "OK",
    stock: r.stock,
    reserved: r.reserved,
    available: r.available,
    threshold: r.threshold,
    price: r.pricePoisha,
    value: r.value,
  }));
  const byFragrance = new Map<string, number>();
  for (const r of rows) byFragrance.set(r.fragrance, (byFragrance.get(r.fragrance) ?? 0) + r.value);
  return {
    key: "inventory",
    title: "Stock value",
    description:
      "Bottles in stock now, valued at shop prices. Held bottles belong to unpaid orders.",
    timeless: true,
    chart: {
      kind: "bars",
      title: "Stock value by fragrance",
      money: true,
      points: [...byFragrance]
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ key: k, label: k, value: v })),
    },
    tables: [
      {
        id: "inventory",
        table: {
          columns: [
            { key: "fragrance", label: "Fragrance", kind: "text" },
            { key: "size", label: "Size", kind: "text" },
            { key: "sku", label: "SKU", kind: "text" },
            { key: "state", label: "State", kind: "text" },
            { key: "stock", label: "In stock", kind: "count" },
            { key: "reserved", label: "Held", kind: "count" },
            { key: "available", label: "Available", kind: "count" },
            { key: "threshold", label: "Low at", kind: "count" },
            { key: "price", label: "Price", kind: "taka", money: true },
            { key: "value", label: "Stock value", kind: "taka", money: true },
          ],
          rows,
          totals: {
            fragrance: "Total",
            size: null,
            sku: null,
            state: null,
            stock: rows.reduce((s, r) => s + r.stock, 0),
            reserved: rows.reduce((s, r) => s + r.reserved, 0),
            available: rows.reduce((s, r) => s + r.available, 0),
            threshold: null,
            price: null,
            value: rows.reduce((s, r) => s + r.value, 0),
          },
        },
      },
    ],
  };
}

/** Each coupon used in the period: orders, discount given, and what those orders brought in */
async function couponReport(range: Range, exec: Executor): Promise<Report> {
  const rows = await exec
    .select({
      code: sql<string>`coalesce(upper(${orders.couponCode}), '')`,
      description: sql<string | null>`max(${coupons.description})`,
      orders: sql<number>`count(*)::int`,
      discount: sql<number>`coalesce(sum(${orders.discount}), 0)::bigint`,
      freeShipping: sql<number>`(count(*) filter (where ${orders.couponCode} is not null and ${orders.shippingFee} = 0))::int`,
      gross: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}), 0)::bigint`,
    })
    .from(orders)
    .leftJoin(coupons, eq(coupons.id, orders.couponId))
    .where(and(SOLD, placedIn(range)))
    .groupBy(sql`1`);
  const all = rows.reduce((s, r) => s + n(r.orders), 0);
  const used = rows.filter((r) => r.code);
  const none = rows.find((r) => !r.code);
  const table = used
    .map((r) => ({
      code: r.code,
      note: (r.description ?? "").replace(/\s*\[demo\]\s*/i, "") || null,
      orders: n(r.orders),
      share: share(n(r.orders), all),
      discount: n(r.discount),
      freeShipping: n(r.freeShipping),
      revenue: n(r.revenue),
      aov: n(r.orders) ? Math.round(n(r.gross) / n(r.orders)) : null,
    }))
    .sort((a, b) => b.orders - a.orders || b.discount - a.discount);
  return {
    key: "coupons",
    title: "Coupons",
    description:
      "Orders placed with each code. Discount is what the code took off; free shipping is counted, not priced. The last row is orders without a code, for comparison.",
    chart: {
      kind: "bars",
      title: "Orders by code",
      money: false,
      points: table.map((r) => ({ key: r.code, label: r.code, value: r.orders })),
    },
    tables: [
      {
        id: "coupons",
        table: {
          columns: [
            { key: "code", label: "Code", kind: "text" },
            { key: "note", label: "About", kind: "text" },
            { key: "orders", label: "Orders", kind: "count" },
            { key: "share", label: "Of all orders", kind: "percent" },
            { key: "discount", label: "Discount given", kind: "taka", money: true },
            { key: "freeShipping", label: "Free shipping", kind: "count" },
            { key: "revenue", label: "Revenue", kind: "taka", money: true },
            { key: "aov", label: "Average order", kind: "taka", money: true },
          ],
          rows: [
            ...table,
            {
              code: "No code",
              note: null,
              orders: n(none?.orders),
              share: share(n(none?.orders), all),
              discount: 0,
              freeShipping: 0,
              revenue: n(none?.revenue),
              aov: n(none?.orders) ? Math.round(n(none?.gross) / n(none?.orders)) : null,
            },
          ],
        },
      },
    ],
  };
}

/** Inside and outside Dhaka: orders, revenue, shipping collected, delivery time, failed deliveries */
async function zones(range: Range, exec: Executor): Promise<Report> {
  const rows = await exec
    .select({
      zone: orders.zone,
      orders: sql<number>`(count(*) filter (where ${SOLD}))::int`,
      revenue: sql<number>`coalesce(sum(${orders.total} - ${REFUNDED}) filter (where ${SOLD}), 0)::bigint`,
      gross: sql<number>`coalesce(sum(${orders.total}) filter (where ${SOLD}), 0)::bigint`,
      shipping: sql<number>`coalesce(sum(${orders.shippingFee}) filter (where ${SOLD}), 0)::bigint`,
      delivered: sql<number>`(count(*) filter (where ${orders.deliveredAt} is not null))::int`,
      days: sql<
        number | null
      >`avg(extract(epoch from (${orders.deliveredAt} - ${orders.shippedAt})) / 86400) filter (where ${orders.deliveredAt} is not null and ${orders.shippedAt} is not null and ${orders.deliveredAt} > ${orders.shippedAt})`,
      failed: sql<number>`(count(*) filter (where ${orders.deliveryFailedAt} is not null))::int`,
      returned: sql<number>`(count(*) filter (where ${orders.status} = 'returned'))::int`,
    })
    .from(orders)
    .where(and(placedIn(range), sql`${orders.status} <> 'pending_payment'`))
    .groupBy(orders.zone);
  const label = { inside_dhaka: "Inside Dhaka", outside_dhaka: "Outside Dhaka" } as const;
  const total = rows.reduce((s, r) => s + n(r.orders), 0);
  const table = (["inside_dhaka", "outside_dhaka"] as const).map((z) => {
    const r = rows.find((x) => x.zone === z);
    const shipped = n(r?.delivered) + n(r?.failed);
    return {
      zone: label[z],
      orders: n(r?.orders),
      share: share(n(r?.orders), total),
      revenue: n(r?.revenue),
      shipping: n(r?.shipping),
      aov: n(r?.orders) ? Math.round(n(r?.gross) / n(r?.orders)) : null,
      days: r?.days == null ? null : Math.round(Number(r.days) * 10) / 10,
      failed: n(r?.failed),
      failRate: shipped ? n(r?.failed) / shipped : 0,
      returned: n(r?.returned),
    };
  });
  return {
    key: "zones",
    title: "Zones",
    description:
      "Orders by delivery zone. Delivery time runs from the courier's pickup to delivery. A failed delivery counts once per order, even if it was delivered later.",
    chart: {
      kind: "split",
      title: "Orders by zone",
      money: false,
      points: table.map((r) => ({ key: r.zone, label: r.zone, value: r.orders })),
    },
    tables: [
      {
        id: "zones",
        table: {
          columns: [
            { key: "zone", label: "Zone", kind: "text" },
            { key: "orders", label: "Orders", kind: "count" },
            { key: "share", label: "Share", kind: "percent" },
            { key: "revenue", label: "Revenue", kind: "taka", money: true },
            { key: "shipping", label: "Shipping collected", kind: "taka", money: true },
            { key: "aov", label: "Average order", kind: "taka", money: true },
            { key: "days", label: "Days to deliver", kind: "days" },
            { key: "failed", label: "Failed deliveries", kind: "count" },
            { key: "failRate", label: "Failure rate", kind: "percent" },
            { key: "returned", label: "Returned", kind: "count" },
          ],
          rows: table,
        },
      },
    ],
  };
}

/** Refunds and returns made in the period (dated when they happened), with totals by period */
async function refundsReport(range: Range, by: Bucket, exec: Executor): Promise<Report> {
  const unit = by === "hour" ? "day" : by;
  const inRange = (col: typeof refunds.createdAt | typeof returns.createdAt) =>
    and(gte(col, range.from), lt(col, range.to));
  const [ref, ret] = await Promise.all([
    exec
      .select({
        at: refunds.createdAt,
        number: orders.number,
        amount: refunds.amount,
        status: refunds.status,
        reason: refunds.reason,
        manual: sql<boolean>`${refunds.paymentId} is null`,
        by: adminUsers.name,
      })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, refunds.issuedBy))
      .where(inRange(refunds.createdAt))
      .orderBy(desc(refunds.createdAt)),
    exec
      .select({
        at: returns.createdAt,
        number: orders.number,
        condition: returns.condition,
        restocked: returns.restocked,
        reason: returns.reason,
        bottles: sql<number>`(select coalesce(sum((x->>'qty')::int), 0)::int from jsonb_array_elements(${returns.items}) x)`,
      })
      .from(returns)
      .innerJoin(orders, eq(orders.id, returns.orderId))
      .where(inRange(returns.createdAt))
      .orderBy(desc(returns.createdAt)),
  ]);
  const keys = bucketKeys(range.from, range.to, unit);
  const keyOf = (d: Date) => {
    // The bucket a moment falls in: the last bucket starting at or before it
    const local = new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 13);
    let k = keys[0]!;
    for (const x of keys) if (x <= local) k = x;
    return k;
  };
  const amount = new Map<string, number>();
  for (const r of ref)
    if (r.status === "completed")
      amount.set(keyOf(r.at), (amount.get(keyOf(r.at)) ?? 0) + r.amount);
  const STATUS = { pending: "Processing", completed: "Done", failed: "Failed" } as Record<
    string,
    string
  >;
  return {
    key: "refunds",
    title: "Refunds & returns",
    description: "Refunds by when they were issued, and parcels by when they came back.",
    chart: {
      kind: "time",
      title: "Money refunded",
      money: true,
      points: keys.map((k) => ({ key: k, label: bucketLabel(k, unit), value: amount.get(k) ?? 0 })),
    },
    tables: [
      {
        id: "refunds",
        title: "Refunds",
        table: {
          columns: [
            { key: "at", label: "Issued", kind: "date" },
            { key: "number", label: "Order", kind: "text" },
            { key: "amount", label: "Amount", kind: "taka", money: true },
            { key: "status", label: "Status", kind: "text" },
            { key: "how", label: "How", kind: "text" },
            { key: "reason", label: "Reason", kind: "text" },
            { key: "by", label: "By", kind: "text" },
          ],
          rows: ref.map((r) => ({
            at: r.at,
            number: r.number,
            amount: r.amount,
            status: STATUS[r.status] ?? r.status,
            how: r.manual ? "Paid back by hand" : "Through the gateway",
            reason: r.reason,
            by: r.by,
          })),
          totals: {
            at: "Total done",
            number: null,
            amount: ref.filter((r) => r.status === "completed").reduce((s, r) => s + r.amount, 0),
            status: null,
            how: null,
            reason: null,
            by: null,
          },
        },
      },
      {
        id: "returns",
        title: "Returns",
        table: {
          columns: [
            { key: "at", label: "Back", kind: "date" },
            { key: "number", label: "Order", kind: "text" },
            { key: "bottles", label: "Bottles", kind: "count" },
            { key: "condition", label: "Condition", kind: "text" },
            { key: "restocked", label: "Back in stock", kind: "text" },
            { key: "reason", label: "Why", kind: "text" },
          ],
          rows: ret.map((r) => ({
            at: r.at,
            number: r.number,
            bottles: n(r.bottles),
            condition: RETURN_CONDITION_LABELS[r.condition as ReturnCondition] ?? r.condition,
            restocked: r.restocked ? "Yes" : "No",
            reason: r.reason,
          })),
          totals: {
            at: "Total",
            number: null,
            bottles: ret.reduce((s, r) => s + n(r.bottles), 0),
            condition: null,
            restocked: `${ret.filter((r) => r.restocked).length} of ${ret.length}`,
            reason: null,
          },
        },
      },
    ],
  };
}

/** The report asked for, over the period, grouped `by` where that applies */
export async function buildReport(
  key: ReportKey,
  range: Range,
  by: Bucket,
  exec: Executor = poolDb(),
): Promise<Report> {
  switch (key) {
    case "sales":
      return sales(range, by, exec);
    case "products":
      return products(range, exec);
    case "sizes":
      return sizes(range, exec);
    case "inventory":
      return inventory(exec);
    case "coupons":
      return couponReport(range, exec);
    case "zones":
      return zones(range, exec);
    case "refunds":
      return refundsReport(range, by, exec);
  }
}

/** One cell, as a CSV writes it: taka with two decimals, shares as percentages, dates in UTC */
export function csvValue(v: Row[string], kind: ColumnKind) {
  if (v === null || v === undefined) return "";
  if (kind === "taka") return (Number(v) / 100).toFixed(2);
  if (kind === "percent") return (Number(v) * 100).toFixed(1);
  if (v instanceof Date) return v.toISOString();
  return v;
}
