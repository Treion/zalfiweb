import { and, desc, eq } from "drizzle-orm";
import { orders, payments } from "@/db/schema";
import { formatPhone, normalisePhone } from "@/lib/phone";
import { formatPrice } from "@/lib/money";
import { audit, type Actor } from "@/server/audit";
import { extendReservations } from "@/server/catalog/stock";
import { isUniqueViolation } from "@/server/db/errors";
import { poolDb, withTx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { addEvent } from "@/server/orders/events";
import { getSettings } from "@/server/settings";
import { applyValidation } from "./service";
import type { Validation } from "./types";

/**
 * Payments made by hand, confirmed by the team:
 *  - bKash or Nagad Send Money at checkout. The customer places the order, sends the total to the
 *    shop's number with the order number as reference, then gives the transaction ID (TrxID) on
 *    the order's page. The bottles stay held while the team checks it in the wallet app, and the
 *    order is confirmed (or the customer asked again) from the admin.
 *  - Any unpaid order paid another way (a gateway outage, a phone order, a bank transfer): the
 *    team records the payment and its reference.
 * Either way the payment goes through the same code as a gateway's validated payment, so the
 * order, its stock, the receipt and the reports all follow.
 */

export const WALLETS = ["bkash", "nagad"] as const;
export type Wallet = (typeof WALLETS)[number];
export const WALLET_LABELS: Record<Wallet, string> = { bkash: "bKash", nagad: "Nagad" };

export const HAND_METHODS = ["bkash", "nagad", "bank", "cash", "gateway"] as const;
export type HandMethod = (typeof HAND_METHODS)[number];
export const HAND_LABELS: Record<HandMethod, string> = {
  bkash: "bKash",
  nagad: "Nagad",
  bank: "Bank transfer",
  cash: "Cash",
  gateway: "Gateway (paid, but not recorded)",
};

/** A transaction ID as wallets print it: letters and digits, upper case (bKash: 10, Nagad: 8) */
export function normaliseTrxId(input: string) {
  const t = input.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{6,20}$/.test(t) ? t : null;
}

/** How long a claimed payment holds the bottles while the team checks it */
const CHECK_HOLD_DAYS = 14;

/** The wallets the shop takes, with the numbers to send to (for checkout and the order page) */
export async function manualWallets() {
  const { manual } = await getSettings("payments");
  if (!manual.enabled) return [];
  return WALLETS.filter((w) => manual[w].enabled && manual[w].number).map((w) => ({
    wallet: w,
    label: WALLET_LABELS[w],
    number: manual[w].number,
    accountType: manual[w].accountType,
  }));
}

/** The customer says they've paid: their wallet, the number they sent from, and the TrxID */
export async function submitManualPayment(
  accessToken: string,
  input: { wallet: Wallet; sender: string; trxId: string },
) {
  const trxId = normaliseTrxId(input.trxId);
  if (!trxId) throw new UserFacingError("Check the transaction ID: letters and numbers only.");
  const sender = normalisePhone(input.sender);
  if (!sender) throw new UserFacingError("Add the mobile number you sent the money from.");
  const wallets = await manualWallets();
  if (!wallets.some((w) => w.wallet === input.wallet))
    throw new UserFacingError(`${WALLET_LABELS[input.wallet]} isn't taken right now.`);

  try {
    return await withTx(async (tx) => {
      const [o] = await tx
        .select()
        .from(orders)
        .where(eq(orders.accessToken, accessToken))
        .for("update");
      if (!o) throw new UserFacingError("That order no longer exists.");
      if (o.paymentMethod !== "manual")
        throw new UserFacingError("This order is paid another way.");
      if (o.paymentStatus === "paid") throw new UserFacingError("This order is already paid.");
      if (o.status !== "pending_payment")
        throw new UserFacingError("This order is no longer waiting for payment.");
      const [waiting] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.orderId, o.id), eq(payments.status, "initiated")))
        .limit(1);
      if (waiting)
        throw new UserFacingError("We have your transaction ID already, and we're checking it.");

      await tx.insert(payments).values({
        orderId: o.id,
        provider: "manual",
        // Unique across every payment: one TrxID can't pay two orders
        tranId: `${input.wallet.toUpperCase()}-${trxId}`,
        amount: o.total,
        status: "initiated",
        methodReported: input.wallet,
        raw: [{ at: new Date().toISOString(), source: "customer", data: { sender, trxId } }],
      });
      // The clock stops: the team checks it, however long that takes, and the bottles stay held
      await tx
        .update(orders)
        .set({ expiresAt: null, updatedAt: new Date() })
        .where(eq(orders.id, o.id));
      await extendReservations(tx, o.id, new Date(Date.now() + CHECK_HOLD_DAYS * 86_400_000));
      await addEvent(tx, o.id, {
        type: "payment",
        actor: "customer",
        message: `The customer says they sent ${formatPrice(o.total)} by ${WALLET_LABELS[input.wallet]} from ${formatPhone(sender)}, transaction ID ${trxId}. Check it in the ${WALLET_LABELS[input.wallet]} app, then confirm it.`,
      });
      return { number: o.number };
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new UserFacingError(
        "That transaction ID has been used already. Check it and try again.",
      );
    throw e;
  }
}

function confirmedBy(p: typeof payments.$inferSelect, amount: number, admin: Actor, note: string) {
  const data = (Array.isArray(p.raw) ? p.raw : []).find(
    (r: { source?: string }) => r?.source === "customer" || r?.source === "admin",
  ) as { data?: { trxId?: string; reference?: string } } | undefined;
  return {
    valid: true,
    status: "CONFIRMED",
    tranId: p.tranId,
    valId: null,
    amount,
    currency: "BDT",
    method: p.methodReported,
    bankTranId: data?.data?.trxId ?? data?.data?.reference ?? null,
    risky: false,
    riskTitle: null,
    raw: { confirmedBy: admin.email, note },
  } satisfies Validation;
}

/** The team found the money: the payment is confirmed, and the order with it */
export async function confirmManualPayment(
  paymentId: number,
  input: { amount: number; note: string },
  admin: Actor,
) {
  const [p] = await poolDb().select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p || p.provider !== "manual") throw new UserFacingError("That payment no longer exists.");
  if (p.status !== "initiated") throw new UserFacingError("That payment has been settled already.");
  if (input.amount !== p.amount)
    throw new UserFacingError(
      `The order is ${formatPrice(p.amount)}. If a different amount arrived, ask the customer before confirming.`,
    );
  const outcome = await applyValidation(
    p.id,
    confirmedBy(p, input.amount, admin, input.note),
    "admin",
  );
  await withTx(async (tx) => {
    await audit(tx, admin, "payment.manual-confirm", {
      entity: "payment",
      entityId: p.tranId,
      after: { amount: input.amount, note: input.note || null, outcome },
    });
  });
  return outcome;
}

/** The money isn't there: the customer is asked again, and the order waits for them */
export async function rejectManualPayment(paymentId: number, reason: string, admin: Actor) {
  const { manual } = await getSettings("payments");
  await withTx(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.provider !== "manual") throw new UserFacingError("That payment no longer exists.");
    if (p.status !== "initiated")
      throw new UserFacingError("That payment has been settled already.");
    await tx
      .update(payments)
      .set({
        status: "failed",
        validation: { accepted: false, reason, checkedBy: admin.email },
        updatedAt: new Date(),
      })
      .where(eq(payments.id, p.id));
    const expiresAt = new Date(Date.now() + manual.holdHours * 3_600_000);
    const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
    if (o?.status === "pending_payment") {
      await tx
        .update(orders)
        .set({ paymentStatus: "failed", expiresAt, updatedAt: new Date() })
        .where(eq(orders.id, o.id));
      await extendReservations(tx, o.id, expiresAt);
    }
    await addEvent(tx, p.orderId, {
      type: "payment",
      actor: `admin:${admin.id}`,
      message: `Payment not found (${reason}). The customer can send the transaction ID again; the order waits ${manual.holdHours} hours.`,
    });
    await audit(tx, admin, "payment.manual-reject", {
      entity: "payment",
      entityId: p.tranId,
      after: { reason },
    });
  });
}

/**
 * Any unpaid order, paid another way: the team records how, and the reference. The order then
 * moves on exactly as if a gateway had confirmed it.
 */
export async function recordPaymentByHand(
  orderId: number,
  input: { method: HandMethod; reference: string; amount: number },
  admin: Actor,
) {
  const reference = input.reference.trim().slice(0, 60);
  if (reference.length < 3) throw new UserFacingError("Add the payment's reference.");
  let paymentId: number;
  try {
    paymentId = await withTx(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!o) throw new UserFacingError("That order no longer exists.");
      if (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded")
        throw new UserFacingError(`${o.number} is paid already.`);
      if (o.status === "cancelled" || o.status === "returned")
        throw new UserFacingError(`${o.number} is ${o.status}: nothing to pay.`);
      if (input.amount !== o.total)
        throw new UserFacingError(`Record the order's total, ${formatPrice(o.total)}.`);
      const [p] = await tx
        .insert(payments)
        .values({
          orderId: o.id,
          provider: "manual",
          tranId: `HAND-${input.method.toUpperCase()}-${reference.replace(/\s+/g, "").toUpperCase()}`,
          amount: o.total,
          status: "initiated",
          methodReported: input.method,
          raw: [
            { at: new Date().toISOString(), source: "admin", data: { reference, by: admin.email } },
          ],
        })
        .returning({ id: payments.id });
      await addEvent(tx, o.id, {
        type: "payment",
        actor: `admin:${admin.id}`,
        message: `Payment of ${formatPrice(o.total)} recorded by hand: ${HAND_LABELS[input.method]}, reference ${reference}.`,
      });
      return p!.id;
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new UserFacingError("A payment with that reference is recorded already.");
    throw e;
  }
  const [p] = await poolDb().select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  const outcome = await applyValidation(
    paymentId,
    confirmedBy(p!, input.amount, admin, ""),
    "admin",
  );
  await audit(poolDb(), admin, "payment.record-by-hand", {
    entity: "order",
    entityId: orderId,
    after: { method: input.method, reference, amount: input.amount, outcome },
  });
  return outcome;
}

/** The customer's latest bKash or Nagad claim on an order, for its page */
export async function latestManualPayment(orderId: number) {
  const [p] = await poolDb()
    .select({
      status: payments.status,
      wallet: payments.methodReported,
      tranId: payments.tranId,
      validation: payments.validation,
    })
    .from(payments)
    .where(and(eq(payments.orderId, orderId), eq(payments.provider, "manual")))
    .orderBy(desc(payments.id))
    .limit(1);
  if (!p) return null;
  return {
    status: p.status,
    wallet: p.wallet,
    trxId: p.tranId.replace(/^[A-Z]+-/, ""),
    reason: (p.validation as { reason?: string } | null)?.reason ?? null,
  };
}
