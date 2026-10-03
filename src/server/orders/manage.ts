import { and, asc, eq, lte, sql } from "drizzle-orm";
import { orderEvents, orderItems, orders } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor, type Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { releaseReservations, restock } from "@/server/catalog/stock";
import { revalidateStorefront } from "@/server/catalog/products";
import { addEvent, type EventActor } from "./events";
import {
  STATUS_LABELS,
  STATUS_TIMESTAMP,
  SOLD_STATUSES,
  TRANSITIONS,
  assertTransition,
  type OrderStatus,
} from "./state";

export type OrderRow = typeof orders.$inferSelect;

async function lockOrder(tx: Tx, id: number) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
  if (!o) throw new UserFacingError("That order no longer exists.");
  return o;
}

/** Statuses an admin may move an order to by hand (confirming happens through payment) */
export const manualNext = (o: Pick<OrderRow, "status">): OrderStatus[] =>
  TRANSITIONS[o.status].filter((s) => s !== "confirmed");

/** Whether moving to `to` can put bottles back on the shelf */
export const offersRestock = (from: OrderStatus, to: OrderStatus) =>
  (to === "cancelled" && SOLD_STATUSES.includes(from)) || to === "returned";

/**
 * Moves an order along the state machine, inside a transaction, with its side effects:
 *  - cancelling an unpaid order releases its held stock; cancelling a confirmed or packed one puts
 *    its bottles back when `restock` is ticked
 *  - a return puts the bottles back when `restock` is ticked
 *  - delivering a cash-on-delivery order marks it paid (the courier collected the cash)
 * Every move writes a timeline event; admin moves are also audit-logged.
 */
export async function transitionOrder(
  tx: Tx,
  orderId: number,
  to: OrderStatus,
  opts: { actor: EventActor; admin?: Actor | null; note?: string; restock?: boolean },
) {
  const o = await lockOrder(tx, orderId);
  if (o.status === to) return o;
  assertTransition(o.status, to);

  const now = new Date();
  const set: Partial<typeof orders.$inferInsert> = { status: to, updatedAt: now };
  const stamp = STATUS_TIMESTAMP[to];
  if (stamp) set[stamp] = now;

  const lines = await tx
    .select({ variantId: orderItems.variantId, qty: orderItems.qty })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const stockLines = lines.flatMap((l) =>
    l.variantId ? [{ variantId: l.variantId, qty: l.qty }] : [],
  );
  const label = `Order ${o.number}`;
  const extras: string[] = [];

  if (to === "cancelled" && o.status === "pending_payment") {
    const n = await releaseReservations(tx, orderId);
    if (n) extras.push("Held stock released.");
  }
  if (opts.restock && offersRestock(o.status, to)) {
    await restock(
      tx,
      orderId,
      stockLines,
      to === "returned" ? "return_restock" : "cancel_restock",
      label,
      opts.admin?.id,
    );
    extras.push("Bottles put back in stock.");
  }
  if (to === "delivered" && o.paymentMethod === "cod" && o.paymentStatus === "unpaid") {
    set.paymentStatus = "paid";
    extras.push("Cash collected on delivery.");
  }
  if (to === "cancelled" && o.paymentStatus === "paid")
    extras.push("This order was paid: issue a refund from the payment panel.");

  const [updated] = await tx.update(orders).set(set).where(eq(orders.id, orderId)).returning();
  await addEvent(tx, orderId, {
    type: "status",
    from: o.status,
    to,
    actor: opts.actor,
    message: [`${STATUS_LABELS[o.status]} → ${STATUS_LABELS[to]}.`, opts.note, ...extras]
      .filter(Boolean)
      .join(" "),
  });
  if (opts.admin)
    await audit(tx, opts.admin, `order.${to}`, {
      entity: "order",
      entityId: o.number,
      before: { status: o.status, paymentStatus: o.paymentStatus },
      after: { status: to, paymentStatus: updated!.paymentStatus, restock: !!opts.restock },
    });
  return updated!;
}

/** An admin moves one or more orders. Returns how many moved; the rest are left as they were. */
export async function moveOrders(
  ids: number[],
  to: OrderStatus,
  admin: Actor,
  opts: { note?: string; restock?: boolean } = {},
) {
  if (to === "confirmed") throw new UserFacingError("Orders are confirmed by their payment.");
  let moved = 0;
  const skipped: string[] = [];
  for (const id of ids) {
    try {
      await withTx((tx) =>
        transitionOrder(tx, id, to, { actor: `admin:${admin.id}`, admin, ...opts }),
      );
      moved++;
    } catch (e) {
      if (ids.length === 1) throw e;
      skipped.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (to === "cancelled" || to === "returned") await revalidateStorefront();
  return { moved, skipped };
}

export async function addNote(orderId: number, text: string, admin: Actor & { name?: string }) {
  await withTx(async (tx) => {
    await lockOrder(tx, orderId);
    await addEvent(tx, orderId, { type: "note", message: text, actor: `admin:${admin.id}` });
    await tx.update(orders).set({ updatedAt: new Date() }).where(eq(orders.id, orderId));
  });
}

/**
 * Unpaid online orders past their expiry are cancelled and their held stock released (cron, every
 * 10 minutes). Availability already ignores expired holds, so a late run sells nothing twice.
 */
export async function expireUnpaidOrders(exec: Executor = poolDb()) {
  const due = await exec
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lte(orders.expiresAt, sql`now()`)))
    .orderBy(asc(orders.id))
    .limit(200);
  let n = 0;
  for (const { id } of due) {
    await withTx(async (tx) => {
      const o = await lockOrder(tx, id);
      if (o.status !== "pending_payment") return;
      await transitionOrder(tx, id, "cancelled", {
        actor: "system",
        note: "Payment wasn't completed in time.",
      });
      n++;
    });
  }
  return n;
}

export async function orderTimeline(orderId: number, exec: Executor = poolDb()) {
  return exec
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt), asc(orderEvents.id));
}
