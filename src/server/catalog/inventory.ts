import { and, asc, count, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { ListParams } from "@/components/admin/data-table/url-state";
import {
  adminUsers,
  discoverySets,
  fragrances,
  orders,
  stockMovements,
  variants,
} from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { getSettings } from "@/server/settings";
import { revalidateStorefront } from "./products";
import { ADJUST_REASONS, type stockAdjustSchema } from "./schema";
import {
  adjustStock,
  availableOf,
  effectiveThreshold,
  reservedBy,
  stockLevel,
  type StockLevel,
} from "./stock";

export type InventoryRow = {
  variantId: number;
  /** A fragrance's size, or (setId) a discovery set's pack */
  fragranceId: number | null;
  setId: number | null;
  name: string;
  slug: string;
  sku: string;
  sizeMl: number;
  pieces: number;
  active: boolean;
  published: boolean;
  pricePoisha: number;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  ownThreshold: number | null;
  value: number;
  level: StockLevel;
};

/** The fragrance or discovery set a variant belongs to (variants join both, one matches) */
const ownerName = sql<string>`coalesce(${fragrances.name}, ${discoverySets.name})`;
const ownerSlug = sql<string>`coalesce(${fragrances.slug}, ${discoverySets.slug})`;
const ownerPublished = sql<boolean>`coalesce(${fragrances.published}, ${discoverySets.published})`;

/** Every size (and every discovery set's pack) with its stock, reserved, available, threshold and
 *  stock value: the bottles first, then the sets */
export async function listInventory(exec: Executor = poolDb()): Promise<InventoryRow[]> {
  const [rows, inv] = await Promise.all([
    exec
      .select({
        variantId: variants.id,
        fragranceId: variants.fragranceId,
        setId: variants.setId,
        name: ownerName,
        slug: ownerSlug,
        sku: variants.sku,
        sizeMl: variants.sizeMl,
        pieces: variants.pieces,
        active: variants.active,
        published: ownerPublished,
        pricePoisha: variants.pricePoisha,
        stock: variants.stock,
        ownThreshold: variants.lowStockThreshold,
      })
      .from(variants)
      .leftJoin(fragrances, eq(fragrances.id, variants.fragranceId))
      .leftJoin(discoverySets, eq(discoverySets.id, variants.setId))
      .orderBy(
        sql`${variants.setId} is not null`,
        sql`coalesce(${fragrances.sortOrder}, ${discoverySets.sortOrder})`,
        asc(variants.sizeMl),
      ),
    getSettings("inventory", exec),
  ]);
  const reserved = await reservedBy(
    exec,
    rows.map((r) => r.variantId),
  );
  return rows.map((r) => {
    const res = reserved.get(r.variantId) ?? 0;
    const available = availableOf(r.stock, res);
    const threshold = effectiveThreshold(r.ownThreshold, inv.lowStockThreshold);
    return {
      ...r,
      reserved: res,
      available,
      threshold,
      value: r.stock * r.pricePoisha,
      level: r.active ? stockLevel(available, threshold) : "ok",
    };
  });
}

/** How many active sizes are low or out (the sidebar badge and the overview) */
export async function lowStockCount(exec: Executor = poolDb()) {
  return (await listInventory(exec)).filter((r) => r.active && r.published && r.level !== "ok")
    .length;
}

export async function adjustStockAdmin(input: z.output<typeof stockAdjustSchema>, actor: Actor) {
  const label = ADJUST_REASONS.find((r) => r.value === input.reason)?.label ?? input.reason;
  const reason = input.note ? `${label}: ${input.note}` : label;
  const next = await withTx(async (tx) => {
    const [before] = await tx
      .select({ stock: variants.stock, sku: variants.sku })
      .from(variants)
      .where(eq(variants.id, input.variantId));
    const stock = await adjustStock(tx, {
      variantId: input.variantId,
      delta: input.delta,
      type: "manual_adjustment",
      reason,
      adminUserId: actor.id,
      respectReservations: input.delta < 0,
    });
    await audit(tx, actor, "stock.adjust", {
      entity: "variant",
      entityId: input.variantId,
      before: { sku: before?.sku, stock: before?.stock },
      after: { stock, delta: input.delta, reason },
    });
    return stock;
  });
  await revalidateStorefront();
  return next;
}

export async function setThreshold(variantId: number, threshold: number | null, actor: Actor) {
  await withTx(async (tx) => {
    const [before] = await tx
      .select({ t: variants.lowStockThreshold })
      .from(variants)
      .where(eq(variants.id, variantId));
    await tx
      .update(variants)
      .set({ lowStockThreshold: threshold, updatedAt: new Date() })
      .where(eq(variants.id, variantId));
    await audit(tx, actor, "stock.threshold", {
      entity: "variant",
      entityId: variantId,
      before: { threshold: before?.t },
      after: { threshold },
    });
  });
}

/* ---------------------------------------------------------------------------------------------- */
/* Movement history                                                                                 */

export const MOVEMENT_TYPES = [
  { value: "initial", label: "Opening stock" },
  { value: "sale", label: "Sale" },
  { value: "cancel_restock", label: "Cancelled, restocked" },
  { value: "return_restock", label: "Returned, restocked" },
  { value: "manual_adjustment", label: "Adjustment" },
] as const;

function movementWhere(p: ListParams): SQL | undefined {
  const parts: (SQL | undefined)[] = [];
  if (p.q) {
    const like = `%${p.q.replace(/[%_\\]/g, "\\$&")}%`;
    parts.push(
      or(
        ilike(variants.sku, like),
        ilike(ownerName, like),
        ilike(stockMovements.reason, like),
        ilike(orders.number, like),
      ),
    );
  }
  const type = p.filters.type;
  if (type && MOVEMENT_TYPES.some((t) => t.value === type))
    parts.push(eq(stockMovements.type, type as (typeof MOVEMENT_TYPES)[number]["value"]));
  if (p.filters.variant && /^\d+$/.test(p.filters.variant))
    parts.push(eq(stockMovements.variantId, Number(p.filters.variant)));
  const days = Number(p.filters.days);
  if (days > 0)
    parts.push(gte(stockMovements.createdAt, sql`now() - make_interval(days => ${days})`));
  if (p.filters.before && /^\d{4}-\d{2}-\d{2}$/.test(p.filters.before))
    parts.push(lt(stockMovements.createdAt, new Date(p.filters.before)));
  return parts.length ? and(...parts) : undefined;
}

export async function listMovements(p: ListParams, limit = p.pageSize, exec: Executor = poolDb()) {
  const w = movementWhere(p);
  const base = () =>
    exec
      .select({
        id: stockMovements.id,
        createdAt: stockMovements.createdAt,
        type: stockMovements.type,
        delta: stockMovements.delta,
        reason: stockMovements.reason,
        sku: variants.sku,
        sizeMl: variants.sizeMl,
        pieces: variants.pieces,
        name: ownerName,
        orderId: stockMovements.orderId,
        orderNumber: orders.number,
        by: adminUsers.name,
      })
      .from(stockMovements)
      .innerJoin(variants, eq(variants.id, stockMovements.variantId))
      .leftJoin(fragrances, eq(fragrances.id, variants.fragranceId))
      .leftJoin(discoverySets, eq(discoverySets.id, variants.setId))
      .leftJoin(orders, eq(orders.id, stockMovements.orderId))
      .leftJoin(adminUsers, eq(adminUsers.id, stockMovements.adminUserId));
  const [rows, [total]] = await Promise.all([
    base()
      .where(w)
      .orderBy(
        p.dir === "asc" ? asc(stockMovements.createdAt) : desc(stockMovements.createdAt),
        desc(stockMovements.id),
      )
      .limit(limit)
      .offset((p.page - 1) * p.pageSize),
    exec
      .select({ n: count() })
      .from(stockMovements)
      .innerJoin(variants, eq(variants.id, stockMovements.variantId))
      .leftJoin(fragrances, eq(fragrances.id, variants.fragranceId))
      .leftJoin(discoverySets, eq(discoverySets.id, variants.setId))
      .leftJoin(orders, eq(orders.id, stockMovements.orderId))
      .where(w),
  ]);
  return { rows, total: total?.n ?? 0 };
}
