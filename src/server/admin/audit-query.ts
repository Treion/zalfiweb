import { and, asc, count, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import { auditLog } from "@/db/schema";
import type { ListParams } from "@/components/admin/data-table/url-state";
import { poolDb } from "@/server/db/pool";

/** The audit log's searchable, filterable list (Activity page and its CSV export) */
export const AUDIT_AREAS = [
  { value: "team", label: "Team" },
  { value: "settings", label: "Settings" },
  { value: "export", label: "Exports" },
  { value: "product", label: "Products" },
  { value: "stock", label: "Stock" },
  { value: "order", label: "Orders" },
  { value: "payment", label: "Payments" },
  { value: "refund", label: "Refunds" },
  { value: "shipment", label: "Shipping" },
  { value: "coupon", label: "Coupons" },
];

function where(p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_\\]/g, "\\$&")}%`;
    parts.push(
      or(
        ilike(auditLog.actorEmail, like),
        ilike(auditLog.action, like),
        ilike(auditLog.entityId, like),
        ilike(auditLog.ip, like),
      ),
    );
  }
  const area = p.filters.area;
  if (area) parts.push(sql`split_part(${auditLog.action}, '.', 1) = ${area}`);
  return parts.length ? and(...parts) : undefined;
}

export async function listAudit(p: ListParams, limit = p.pageSize) {
  const db = poolDb();
  const w = where(p);
  const order = p.dir === "asc" ? asc(auditLog.createdAt) : desc(auditLog.createdAt);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(w)
      .orderBy(order, desc(auditLog.id))
      .limit(limit)
      .offset((p.page - 1) * p.pageSize),
    db.select({ n: count() }).from(auditLog).where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}
