import { asc, eq } from "drizzle-orm";
import { orders, payments, refunds } from "@/db/schema";
import { formatPrice } from "@/lib/money";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor, type Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { addEvent } from "@/server/orders/events";
import { providerByName } from "./providers";
import type { RefundResult } from "./types";

/**
 * Refunds, full or partial. An online payment is refunded through its provider (SSLCommerz takes
 * a while: the refund stays "processing" until its status check says refunded). A cash-on-
 * delivery order is refunded by hand (cash or a mobile transfer), and the refund is only recorded.
 * The order's payment status follows the refunds that have completed.
 */

type PaymentRow = typeof payments.$inferSelect;
type RefundRow = typeof refunds.$inferSelect;

/** How much an order has been paid, refunded and can still be refunded (poisha) */
export function refundable(
  order: { paymentMethod: string; paymentStatus: string; total: number },
  paid: Pick<PaymentRow, "amount" | "status" | "provider">[],
  existing: Pick<RefundRow, "amount" | "status">[],
) {
  // Online payments only: cash is counted from the order (older demo data has "cod" rows)
  const online = paid
    .filter((p) => p.status === "paid" && p.provider !== "cod")
    .reduce((s, p) => s + p.amount, 0);
  // Cash on delivery: the courier collected the total
  const cash =
    order.paymentMethod === "cod" &&
    ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus)
      ? order.total
      : 0;
  const total = online + cash;
  const completed = existing
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + r.amount, 0);
  const pending = existing.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);
  return { paid: total, completed, pending, left: Math.max(0, total - completed - pending) };
}

/** The order's payment status, from what has been refunded */
export function statusAfterRefunds(paid: number, completed: number) {
  if (paid <= 0) return null;
  if (completed >= paid) return "refunded" as const;
  if (completed > 0) return "partially_refunded" as const;
  return "paid" as const;
}

async function syncOrderStatus(tx: Tx, orderId: number) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) return;
  const [ps, rs] = await Promise.all([
    tx.select().from(payments).where(eq(payments.orderId, orderId)),
    tx.select().from(refunds).where(eq(refunds.orderId, orderId)),
  ]);
  const sum = refundable(o, ps, rs);
  const next = statusAfterRefunds(sum.paid, sum.completed);
  if (next && next !== o.paymentStatus)
    await tx
      .update(orders)
      .set({ paymentStatus: next, updatedAt: new Date() })
      .where(eq(orders.id, orderId));
}

export async function orderRefunds(orderId: number, exec: Executor = poolDb()) {
  return exec.select().from(refunds).where(eq(refunds.orderId, orderId)).orderBy(asc(refunds.id));
}

/**
 * Issues a refund. Online payments go back through their provider; cash-on-delivery refunds are
 * recorded as paid back by hand. Refuses more than is left to refund.
 */
export async function issueRefund(
  orderId: number,
  input: { amount: number; reason: string },
  admin: Actor,
) {
  const prep = await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw new UserFacingError("That order no longer exists.");
    const [ps, rs] = await Promise.all([
      tx.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.id)),
      tx.select().from(refunds).where(eq(refunds.orderId, orderId)),
    ]);
    const sum = refundable(o, ps, rs);
    if (sum.paid <= 0)
      throw new UserFacingError("This order hasn't been paid, so there's nothing to refund.");
    if (input.amount <= 0 || input.amount > sum.left)
      throw new UserFacingError(
        sum.left > 0
          ? `You can refund up to ${formatPrice(sum.left)}.`
          : "This order has been refunded in full.",
      );

    // Online: the paid payment with enough left on it
    const refundedFrom = (pid: number) =>
      rs
        .filter((r) => r.paymentId === pid && r.status !== "failed")
        .reduce((s, r) => s + r.amount, 0);
    const payment =
      ps.find(
        (p) =>
          p.status === "paid" &&
          p.provider !== "cod" &&
          p.amount - refundedFrom(p.id) >= input.amount,
      ) ?? null;
    const manual = !payment;
    if (manual && o.paymentMethod !== "cod")
      throw new UserFacingError(
        "Refund each payment separately: no single payment covers that amount.",
      );

    const [row] = await tx
      .insert(refunds)
      .values({
        orderId,
        paymentId: payment?.id ?? null,
        amount: input.amount,
        reason: input.reason,
        status: manual ? "completed" : "pending",
        issuedBy: admin.id,
        providerRef: manual ? "manual" : null,
      })
      .returning();
    await audit(tx, admin, "refund.issue", {
      entity: "order",
      entityId: o.number,
      after: { amount: input.amount, reason: input.reason, manual, refundId: row!.id },
    });
    if (manual) {
      await addEvent(tx, orderId, {
        type: "refund",
        actor: `admin:${admin.id}`,
        message: `Refund of ${formatPrice(input.amount)} recorded, paid back by hand. ${input.reason}`,
      });
      await syncOrderStatus(tx, orderId);
    }
    return { order: o, refund: row!, payment };
  });

  if (!prep.payment) return prep.refund;

  const provider = await providerByName(prep.payment.provider);
  let result: RefundResult;
  if (!provider) {
    result = {
      status: "failed",
      providerRef: null,
      error: "The payment gateway isn't configured",
      raw: null,
    };
  } else {
    const bankTranId =
      ((prep.payment.validation as { bankTranId?: string } | null)?.bankTranId ?? null) || null;
    try {
      result = await provider.refund({
        tranId: prep.payment.tranId,
        bankTranId,
        amount: input.amount,
        reason: input.reason,
        refundKey: `R${prep.refund.id}-${prep.order.number}`,
      });
    } catch (e) {
      result = { status: "failed", providerRef: null, error: (e as Error).message, raw: null };
    }
  }
  return applyRefundResult(prep.refund.id, result, `admin:${admin.id}`);
}

async function applyRefundResult(
  refundId: number,
  r: RefundResult,
  actor: `admin:${string}` | "payment",
) {
  return withTx(async (tx) => {
    const [row] = await tx.select().from(refunds).where(eq(refunds.id, refundId)).for("update");
    if (!row) throw new UserFacingError("That refund no longer exists.");
    const [updated] = await tx
      .update(refunds)
      .set({
        status: r.status,
        providerRef: r.providerRef ?? row.providerRef,
        raw: r.raw ?? row.raw,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refundId))
      .returning();
    if (row.status !== r.status) {
      const amount = formatPrice(row.amount);
      await addEvent(tx, row.orderId, {
        type: "refund",
        actor,
        message:
          r.status === "completed"
            ? `Refund of ${amount} completed.`
            : r.status === "pending"
              ? `Refund of ${amount} sent to the provider, processing. ${row.reason}`
              : `Refund of ${amount} failed: ${r.error ?? "the provider refused it"}.`,
      });
    }
    await syncOrderStatus(tx, row.orderId);
    return updated!;
  });
}

/** Asks the provider about a processing refund */
export async function refreshRefund(refundId: number, admin?: Actor) {
  const [row] = await poolDb()
    .select({ refund: refunds, provider: payments.provider })
    .from(refunds)
    .leftJoin(payments, eq(payments.id, refunds.paymentId))
    .where(eq(refunds.id, refundId))
    .limit(1);
  if (!row) throw new UserFacingError("That refund no longer exists.");
  const { refund, provider: name } = row;
  if (refund.status !== "pending" || !refund.providerRef || !name) return refund;
  const provider = await providerByName(name);
  if (!provider) throw new UserFacingError("The payment gateway isn't configured.");
  const r = await provider.refundStatus(refund.providerRef);
  // A status check that can't be read leaves it processing
  if (r.status === "failed" && r.error?.startsWith("SSLCommerz:")) return refund;
  return applyRefundResult(refundId, r, admin ? `admin:${admin.id}` : "payment");
}

/** Every processing refund, checked (cron) */
export async function refreshPendingRefunds() {
  const pending = await poolDb()
    .select({ id: refunds.id })
    .from(refunds)
    .where(eq(refunds.status, "pending"))
    .limit(100);
  let done = 0;
  for (const { id } of pending) {
    try {
      const r = await refreshRefund(id);
      if (r.status !== "pending") done++;
    } catch (e) {
      console.error(`[refunds] status check ${id}:`, (e as Error).message);
    }
  }
  return done;
}
