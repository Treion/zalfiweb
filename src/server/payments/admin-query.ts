import { and, asc, count, desc, eq, gte, ilike, or, sql, type SQL } from "drizzle-orm";
import type { ListParams } from "@/components/admin/data-table/url-state";
import { adminUsers, orders, payments, refunds } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { refundable } from "./refunds";

/** The Payments page: every payment attempt, every refund, with filters and totals */

export const PAYMENT_FILTER_KEYS = ["status", "provider", "days", "view"];

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

function paymentWhere(p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (p.q) {
    const digits = p.q.replace(/\D/g, "");
    parts.push(
      or(
        ilike(payments.tranId, like(p.q)),
        ilike(orders.number, like(p.q)),
        ilike(orders.customerName, like(p.q)),
        ilike(payments.methodReported, like(p.q)),
        digits.length >= 4
          ? ilike(orders.customerPhone, `%${digits.replace(/^880/, "0").replace(/^0?1/, "1")}%`)
          : undefined,
      ),
    );
  }
  const f = p.filters;
  if (f.status === "refunded")
    parts.push(sql`exists (select 1 from ${refunds} where ${refunds.paymentId} = ${payments.id})`);
  else if (f.status && ["initiated", "paid", "failed", "cancelled"].includes(f.status))
    parts.push(eq(payments.status, f.status as "initiated" | "paid" | "failed" | "cancelled"));
  if (f.provider === "mock" || f.provider === "sslcommerz")
    parts.push(eq(payments.provider, f.provider));
  const days = Number(f.days);
  if (days > 0) parts.push(gte(payments.createdAt, sql`now() - make_interval(days => ${days})`));
  return parts.length ? and(...parts) : undefined;
}

export async function listPaymentsAdmin(
  p: ListParams,
  limit = p.pageSize,
  exec: Executor = poolDb(),
) {
  const w = paymentWhere(p);
  const refunded = sql<number>`(select coalesce(sum(r.amount), 0)::int from refunds r where r.payment_id = "payments"."id" and r.status = 'completed')`;
  const [rows, [total], [sums]] = await Promise.all([
    exec
      .select({
        id: payments.id,
        createdAt: payments.createdAt,
        provider: payments.provider,
        tranId: payments.tranId,
        amount: payments.amount,
        status: payments.status,
        method: payments.methodReported,
        orderId: orders.id,
        orderNumber: orders.number,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        refunded,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(w)
      .orderBy(
        p.dir === "asc" ? asc(payments.createdAt) : desc(payments.createdAt),
        desc(payments.id),
      )
      .limit(limit)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(w),
    exec
      .select({
        collected: sql<number>`coalesce(sum(${payments.amount}) filter (where ${payments.status} = 'paid'), 0)::bigint`,
        paidCount: sql<number>`count(*) filter (where ${payments.status} = 'paid')::int`,
        failedCount: sql<number>`count(*) filter (where ${payments.status} = 'failed')::int`,
        refunded: sql<number>`coalesce(sum(${refunded}), 0)::bigint`,
      })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(w),
  ]);
  return {
    rows: rows.map((r) => ({ ...r, refunded: Number(r.refunded) })),
    total: total?.n ?? 0,
    sums: {
      collected: Number(sums?.collected ?? 0),
      refunded: Number(sums?.refunded ?? 0),
      paidCount: Number(sums?.paidCount ?? 0),
      failedCount: Number(sums?.failedCount ?? 0),
    },
  };
}

export type PaymentListRow = Awaited<ReturnType<typeof listPaymentsAdmin>>["rows"][number];

export async function listRefundsAdmin(p: ListParams, exec: Executor = poolDb()) {
  const parts: (SQL | undefined)[] = [];
  if (p.q) parts.push(or(ilike(orders.number, like(p.q)), ilike(refunds.reason, like(p.q))));
  const st = p.filters.status;
  if (st === "pending" || st === "completed" || st === "failed") parts.push(eq(refunds.status, st));
  const days = Number(p.filters.days);
  if (days > 0) parts.push(gte(refunds.createdAt, sql`now() - make_interval(days => ${days})`));
  const w = parts.length ? and(...parts) : undefined;
  const [rows, [total]] = await Promise.all([
    exec
      .select({
        id: refunds.id,
        createdAt: refunds.createdAt,
        amount: refunds.amount,
        reason: refunds.reason,
        status: refunds.status,
        providerRef: refunds.providerRef,
        manual: sql<boolean>`${refunds.paymentId} is null`,
        orderId: orders.id,
        orderNumber: orders.number,
        customerName: orders.customerName,
        by: adminUsers.name,
      })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, refunds.issuedBy))
      .where(w)
      .orderBy(desc(refunds.createdAt), desc(refunds.id))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}

export type RefundListRow = Awaited<ReturnType<typeof listRefundsAdmin>>["rows"][number];

/** An order's payment attempts and refunds, for its page */
export async function orderPayments(
  order: { id: number; paymentMethod: string; paymentStatus: string; total: number },
  exec: Executor = poolDb(),
) {
  const [ps, rs] = await Promise.all([
    exec.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(desc(payments.id)),
    exec
      .select({ refund: refunds, by: adminUsers.name })
      .from(refunds)
      .leftJoin(adminUsers, eq(adminUsers.id, refunds.issuedBy))
      .where(eq(refunds.orderId, order.id))
      .orderBy(desc(refunds.id)),
  ]);
  const sum = refundable(
    order,
    ps,
    rs.map((r) => r.refund),
  );
  return { payments: ps, refunds: rs.map((r) => ({ ...r.refund, by: r.by })), sum };
}
