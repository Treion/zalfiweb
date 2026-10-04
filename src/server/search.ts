import { and, desc, ilike, or, sql } from "drizzle-orm";
import { customers, fragrances, orders, variants } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";
import type { Permission } from "@/server/auth/permissions";
import { poolDb, type Executor } from "@/server/db/pool";
import { STATUS_LABELS } from "@/server/orders/state";

/**
 * The admin's one search box: orders (by number, phone, name or email), customers (by name, phone
 * or email) and fragrances (by name, slug or SKU). Each group appears only to admins who may open
 * it. Phone numbers match however they're typed (01712-345678, +8801712345678, 1712345678).
 */

export type SearchHit = { title: string; detail: string; href: string };
export type SearchGroup = {
  kind: "orders" | "customers" | "products";
  label: string;
  hits: SearchHit[];
  /** How many match in all (the list shows the first few) */
  total: number;
  /** The full list, filtered by the same search */
  more: string | null;
};

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;
/** The digits of a phone number as stored (01…), for matching any way it was typed */
export const phoneDigits = (q: string) => {
  const d = q.replace(/\D/g, "");
  return d.length >= 4 ? d.replace(/^880/, "0").replace(/^0?1/, "1") : null;
};

export async function globalSearch(
  raw: string,
  can: (p: Permission) => boolean,
  limit = 5,
  exec: Executor = poolDb(),
): Promise<SearchGroup[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const digits = phoneDigits(q);
  const enc = encodeURIComponent(q);
  const tasks: Promise<SearchGroup>[] = [];

  if (can("orders.view")) {
    const w = or(
      ilike(orders.number, like(q)),
      ilike(orders.customerName, like(q)),
      ilike(orders.customerEmail, like(q)),
      digits ? ilike(orders.customerPhone, `%${digits}%`) : undefined,
    );
    tasks.push(
      Promise.all([
        exec
          .select({
            id: orders.id,
            number: orders.number,
            name: orders.customerName,
            phone: orders.customerPhone,
            status: orders.status,
            total: orders.total,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(w)
          // An exact order number first, then the newest
          .orderBy(sql`upper(${orders.number}) = upper(${q}) desc`, desc(orders.createdAt))
          .limit(limit),
        exec
          .select({ n: sql<number>`count(*)::int` })
          .from(orders)
          .where(w),
      ]).then(([rows, [c]]) => ({
        kind: "orders" as const,
        label: "Orders",
        total: c?.n ?? 0,
        more: `/admin/orders?q=${enc}`,
        hits: rows.map((o) => ({
          title: o.number,
          detail: `${o.name} · ${formatPhone(o.phone)} · ${STATUS_LABELS[o.status]} · ${formatPrice(o.total)} · ${formatDate(o.createdAt)}`,
          href: `/admin/orders/${o.id}`,
        })),
      })),
    );
  }

  if (can("customers.view")) {
    const w = or(
      ilike(customers.name, like(q)),
      ilike(customers.email, like(q)),
      digits ? ilike(customers.phone, `%${digits}%`) : undefined,
    );
    tasks.push(
      Promise.all([
        exec
          .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
          })
          .from(customers)
          .where(w)
          .orderBy(desc(customers.updatedAt))
          .limit(limit),
        exec
          .select({ n: sql<number>`count(*)::int` })
          .from(customers)
          .where(w),
      ]).then(([rows, [c]]) => ({
        kind: "customers" as const,
        label: "Customers",
        total: c?.n ?? 0,
        more: `/admin/customers?q=${enc}`,
        hits: rows.map((r) => ({
          title: r.name,
          detail: [formatPhone(r.phone), r.email].filter(Boolean).join(" · "),
          href: `/admin/customers/${r.id}`,
        })),
      })),
    );
  }

  if (can("products.manage")) {
    const w = or(
      ilike(fragrances.name, like(q)),
      ilike(fragrances.slug, like(q)),
      sql`exists (select 1 from ${variants} v where v.fragrance_id = ${sql.raw(`"fragrances"."id"`)} and v.sku ilike ${like(q)})`,
    );
    tasks.push(
      Promise.all([
        exec
          .select({
            id: fragrances.id,
            name: fragrances.name,
            published: fragrances.published,
            tagline: fragrances.tagline,
            skus: sql<string>`(select string_agg(v.sku, ', ' order by v.size_ml) from ${variants} v where v.fragrance_id = ${sql.raw(`"fragrances"."id"`)})`,
          })
          .from(fragrances)
          .where(and(w, sql`${fragrances.slug} not like 'zz-%'`))
          .orderBy(fragrances.sortOrder)
          .limit(limit),
        exec
          .select({ n: sql<number>`count(*)::int` })
          .from(fragrances)
          .where(and(w, sql`${fragrances.slug} not like 'zz-%'`)),
      ]).then(([rows, [c]]) => ({
        kind: "products" as const,
        label: "Fragrances",
        total: c?.n ?? 0,
        more: null,
        hits: rows.map((f) => ({
          title: f.name,
          detail: [f.published ? f.tagline : "Hidden from the shop", f.skus]
            .filter(Boolean)
            .join(" · "),
          href: `/admin/products/${f.id}`,
        })),
      })),
    );
  }

  return (await Promise.all(tasks)).filter((g) => g.total > 0);
}
