import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { stockMovements, stockReservations, variants } from "@/db/schema";
import type { Executor, Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";

/**
 * Stock, as a ledger. Every change to a size's stock is one `stock_movements` row, written in the
 * same transaction as the change to `variants.stock`, so stock always equals the sum of the ledger
 * (`npm run stock:check`).
 *
 * Reservations hold bottles for unpaid online-payment orders: "available" is stock minus the
 * reservations still active (not released, not expired). Reserving locks the size's row first, so
 * two checkouts racing for the last bottle are served one after the other: only one gets it.
 */

export type MovementType = (typeof stockMovements.$inferInsert)["type"];

export class OutOfStock extends UserFacingError {
  constructor(
    readonly variantId: number,
    readonly available: number,
  ) {
    super(
      available > 0
        ? `Only ${available} left of one of the bottles.`
        : "One of the bottles just sold out.",
    );
  }
}

/** Reservations that still hold stock */
const activeReservation = () =>
  and(isNull(stockReservations.releasedAt), gt(stockReservations.expiresAt, sql`now()`));

/** Bottles held by active reservations, per variant */
export async function reservedBy(exec: Executor, variantIds: number[]) {
  if (!variantIds.length) return new Map<number, number>();
  const rows = await exec
    .select({
      variantId: stockReservations.variantId,
      qty: sql<number>`sum(${stockReservations.qty})::int`,
    })
    .from(stockReservations)
    .where(and(inArray(stockReservations.variantId, variantIds), activeReservation()))
    .groupBy(stockReservations.variantId);
  return new Map(rows.map((r) => [r.variantId, Number(r.qty)]));
}

/** What a size can still sell: stock minus active reservations (never negative) */
export const availableOf = (stock: number, reserved: number) => Math.max(0, stock - reserved);

/**
 * Changes one size's stock and writes the ledger row. Refuses to go below zero, and (for manual
 * reductions) below what unpaid orders are holding.
 */
export async function adjustStock(
  tx: Tx,
  m: {
    variantId: number;
    delta: number;
    type: MovementType;
    reason?: string | null;
    orderId?: number | null;
    adminUserId?: string | null;
    /** Manual reductions may not dig into reserved bottles */
    respectReservations?: boolean;
  },
) {
  if (!Number.isInteger(m.delta) || m.delta === 0)
    throw new UserFacingError("The change must be a whole number, not zero.");
  const [locked] = await tx
    .select({ stock: variants.stock })
    .from(variants)
    .where(eq(variants.id, m.variantId))
    .for("update");
  if (!locked) throw new UserFacingError("That size no longer exists.");
  const floor = m.respectReservations
    ? ((await reservedBy(tx, [m.variantId])).get(m.variantId) ?? 0)
    : 0;
  const next = locked.stock + m.delta;
  if (next < floor)
    throw new UserFacingError(
      floor > 0
        ? `That would leave ${next} bottles, but ${floor} are held for unpaid orders.`
        : `There are only ${locked.stock} in stock.`,
    );
  await tx
    .update(variants)
    .set({ stock: next, updatedAt: new Date() })
    .where(eq(variants.id, m.variantId));
  await tx.insert(stockMovements).values({
    variantId: m.variantId,
    type: m.type,
    delta: m.delta,
    reason: m.reason ?? null,
    orderId: m.orderId ?? null,
    adminUserId: m.adminUserId ?? null,
  });
  return next;
}

type Line = { variantId: number; qty: number };

/** Merges duplicate sizes and sorts by id, so rows are always locked in the same order (no deadlocks) */
function normalise(lines: Line[]): Line[] {
  const byId = new Map<number, number>();
  for (const l of lines) byId.set(l.variantId, (byId.get(l.variantId) ?? 0) + l.qty);
  return [...byId]
    .map(([variantId, qty]) => ({ variantId, qty }))
    .sort((a, b) => a.variantId - b.variantId);
}

/** Locks the sizes and checks every line can be served; throws OutOfStock otherwise */
async function lockAndCheck(tx: Tx, lines: Line[]) {
  const ids = lines.map((l) => l.variantId);
  const rows = await tx
    .select({ id: variants.id, stock: variants.stock, active: variants.active })
    .from(variants)
    .where(inArray(variants.id, ids))
    .orderBy(asc(variants.id))
    .for("update");
  const reserved = await reservedBy(tx, ids);
  for (const l of lines) {
    const v = rows.find((r) => r.id === l.variantId);
    if (!v || !v.active) throw new OutOfStock(l.variantId, 0);
    const available = availableOf(v.stock, reserved.get(l.variantId) ?? 0);
    if (available < l.qty) throw new OutOfStock(l.variantId, available);
  }
}

/** Holds stock for an unpaid online-payment order until `expiresAt` */
export async function reserveStock(tx: Tx, orderId: number, lines: Line[], expiresAt: Date) {
  const items = normalise(lines);
  await lockAndCheck(tx, items);
  await tx
    .insert(stockReservations)
    .values(items.map((l) => ({ orderId, variantId: l.variantId, qty: l.qty, expiresAt })));
}

/** Holds an order's reserved bottles for longer (a bKash or Nagad payment waiting to be checked) */
export async function extendReservations(tx: Tx, orderId: number, expiresAt: Date) {
  await tx
    .update(stockReservations)
    .set({ expiresAt })
    .where(and(eq(stockReservations.orderId, orderId), isNull(stockReservations.releasedAt)));
}

/** Sells straight from stock (Cash on Delivery): checks availability, then deducts */
export async function sellStock(tx: Tx, orderId: number, lines: Line[], label: string) {
  const items = normalise(lines);
  await lockAndCheck(tx, items);
  for (const l of items)
    await adjustStock(tx, {
      variantId: l.variantId,
      delta: -l.qty,
      type: "sale",
      reason: label,
      orderId,
    });
}

/**
 * Payment confirmed: the order's reservations become sales. Idempotent: a second call finds no
 * active reservations and changes nothing. Returns the number of bottles deducted.
 */
export async function commitReservations(tx: Tx, orderId: number, label: string) {
  const held = await tx
    .update(stockReservations)
    .set({ releasedAt: new Date() })
    .where(and(eq(stockReservations.orderId, orderId), isNull(stockReservations.releasedAt)))
    .returning({ variantId: stockReservations.variantId, qty: stockReservations.qty });
  for (const r of normalise(held))
    await adjustStock(tx, {
      variantId: r.variantId,
      delta: -r.qty,
      type: "sale",
      reason: label,
      orderId,
    });
  return held.reduce((n, r) => n + r.qty, 0);
}

/** The order no longer needs its bottles (cancelled, payment failed, expired) */
export async function releaseReservations(exec: Executor, orderId: number) {
  const rows = await exec
    .update(stockReservations)
    .set({ releasedAt: new Date() })
    .where(and(eq(stockReservations.orderId, orderId), isNull(stockReservations.releasedAt)))
    .returning({ id: stockReservations.id });
  return rows.length;
}

/** Marks lapsed reservations released (housekeeping; availability already ignores them). */
export async function releaseExpiredReservations(exec: Executor) {
  const rows = await exec
    .update(stockReservations)
    .set({ releasedAt: sql`now()` })
    .where(and(isNull(stockReservations.releasedAt), sql`${stockReservations.expiresAt} <= now()`))
    .returning({ orderId: stockReservations.orderId });
  return [...new Set(rows.map((r) => r.orderId))];
}

/** Puts sold bottles back (a cancelled or returned order with "restock" ticked) */
export async function restock(
  tx: Tx,
  orderId: number,
  lines: Line[],
  type: "cancel_restock" | "return_restock",
  label: string,
  adminUserId?: string | null,
) {
  for (const l of normalise(lines))
    if (l.qty > 0)
      await adjustStock(tx, {
        variantId: l.variantId,
        delta: l.qty,
        type,
        reason: label,
        orderId,
        adminUserId,
      });
}

/** The threshold that applies to a size: its own, or the default from Settings */
export const effectiveThreshold = (own: number | null, fallback: number) => own ?? fallback;

export type StockLevel = "out" | "low" | "ok";
export const stockLevel = (available: number, threshold: number): StockLevel =>
  available <= 0 ? "out" : available <= threshold ? "low" : "ok";
