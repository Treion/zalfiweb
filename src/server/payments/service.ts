import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { orderItems, orders, payments, webhookEvents } from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { commitReservations, sellStock } from "@/server/catalog/stock";
import { revalidateStorefront } from "@/server/catalog/products";
import { poolDb, withTx, type Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { addEvent } from "@/server/orders/events";
import { transitionOrder } from "@/server/orders/manage";
import { sendReceipt } from "@/server/orders/receipt";
import { maskPhone } from "@/server/request";
import { currentGateway, providerByName } from "./providers";
import { mismatch } from "./sslcommerz";
import type { Notice, ProviderName, Validation } from "./types";

/**
 * The payment flow, the same for every provider:
 *  1. startPayment: a `payments` row (initiated) and a session at the provider; the customer goes
 *     to its payment page.
 *  2. The provider tells us what happened twice: an IPN to the server, and the customer's browser
 *     coming back. Both go through settleNotice; whichever arrives first settles, and the other
 *     finds it done.
 *  3. A "valid" notice is checked with the provider's validation API. Only a validation that
 *     matches our transaction ID, amount and currency marks the payment paid. Then the held
 *     bottles become a sale, the order is confirmed, and the e-receipt goes out.
 *  4. reconcilePayments (cron) asks the provider about payments still open, in case both notices
 *     were lost.
 */

export const confirmationUrl = (token: string, payment?: string) =>
  `/checkout/thanks?o=${token}${payment ? `&payment=${payment}` : ""}`;

/** ZLF-001046-7KQ2M: the order number and a random tail (each attempt needs its own ID) */
function newTranId(orderNumber: string) {
  const tail = randomBytes(4).toString("base64url").replace(/[-_]/g, "X").slice(0, 5).toUpperCase();
  return `${orderNumber}-${tail}`;
}

function callbackUrls(name: ProviderName) {
  const base = siteUrl().replace(/\/$/, "");
  const ret = `${base}/api/payments/return/${name}`;
  return {
    success: `${ret}?outcome=success`,
    fail: `${ret}?outcome=fail`,
    cancel: `${ret}?outcome=cancel`,
    ipn: `${base}/api/payments/ipn/${name}`,
  };
}

/** Appends one payload to a payment's audit trail (owner-only in the admin) */
const withRaw = (prev: unknown, source: string, data: unknown) => [
  ...(Array.isArray(prev) ? prev : []),
  { at: new Date().toISOString(), source, data },
];

/**
 * Opens a payment for an unpaid online order and returns the payment page's URL. Each call is a
 * new attempt with its own transaction ID (a customer can retry after a failure).
 */
export async function startPayment(orderId: number): Promise<string> {
  const gateway = await currentGateway();
  const provider = gateway.provider;
  if (!provider) throw new UserFacingError("Online payment isn't available right now.");

  const prep = await withTx(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw new UserFacingError("That order no longer exists.");
    if (o.paymentStatus === "paid") return { done: o.accessToken } as const;
    if (o.paymentMethod !== "sslcommerz")
      throw new UserFacingError("This order is paid on delivery.");
    if (o.status !== "pending_payment")
      throw new UserFacingError("This order can no longer be paid online.");
    if (o.expiresAt && o.expiresAt <= new Date())
      throw new UserFacingError("This order waited too long and has expired. Place it again.");
    const tranId = newTranId(o.number);
    const [p] = await tx
      .insert(payments)
      .values({ orderId, provider: provider.name, tranId, amount: o.total, status: "initiated" })
      .returning({ id: payments.id });
    return { order: o, tranId, paymentId: p!.id } as const;
  });
  if ("done" in prep) return confirmationUrl(prep.done!);
  const { order: o, tranId, paymentId } = prep;

  const items = await poolDb()
    .select({ name: orderItems.name, qty: orderItems.qty })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));
  try {
    const session = await provider.createSession({
      tranId,
      amount: o.total,
      orderNumber: o.number,
      customer: {
        name: o.customerName,
        email: o.customerEmail,
        phone: o.customerPhone,
        address: `${o.addressStreet}, ${o.addressArea}`,
        district: o.addressDistrict,
      },
      items,
      urls: callbackUrls(provider.name),
    });
    await poolDb()
      .update(payments)
      .set({ raw: withRaw(null, "session", session.raw), updatedAt: new Date() })
      .where(eq(payments.id, paymentId));
    return session.url;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(`[payments] session failed order=${o.number}: ${reason}`);
    await withTx(async (tx) => {
      await tx
        .update(payments)
        .set({
          status: "failed",
          raw: withRaw(null, "session-error", { reason }),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));
      await addEvent(tx, orderId, {
        type: "payment",
        actor: "payment",
        message: `The payment page couldn't be opened: ${reason}`,
      });
    });
    throw new UserFacingError("We couldn't open the payment page. Try again in a moment.");
  }
}

export type SettleResult = {
  outcome: "paid" | "failed" | "cancelled" | "pending" | "unknown";
  /** The order's access token, to send the customer to its page */
  token: string | null;
};

/** Records a provider callback once; a repeat (same provider and event) returns false */
export async function firstDelivery(provider: string, eventId: string) {
  const rows = await poolDb()
    .insert(webhookEvents)
    .values({ provider, eventId: eventId.slice(0, 300) })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  return rows.length > 0;
}

/**
 * Handles a notice from a provider: an IPN, or the customer's browser coming back. Safe to call
 * any number of times with the same notice.
 */
export async function settleNotice(
  name: string,
  notice: Notice,
  source: "ipn" | "return",
): Promise<SettleResult> {
  const provider = providerByName(name);
  if (!provider) return { outcome: "unknown", token: null };
  const n = provider.handleIpn(notice);
  if (!n.tranId) return { outcome: "unknown", token: null };
  const [row] = await poolDb()
    .select({ id: payments.id, status: payments.status, token: orders.accessToken })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.tranId, n.tranId), eq(payments.provider, name)))
    .limit(1);
  if (!row) return { outcome: "unknown", token: null };
  const token = row.token;

  if (n.status === "valid" && n.valId) {
    if (row.status === "paid") return { outcome: "paid", token };
    let v: Validation;
    try {
      v = await provider.validate(n.valId);
    } catch (e) {
      // The provider can't be reached: nothing changes, and reconcilePayments tries again later
      console.error(`[payments] validation unreachable tran=${n.tranId}:`, (e as Error).message);
      return { outcome: "pending", token };
    }
    return { outcome: await applyValidation(row.id, v, source), token };
  }

  const outcome =
    n.status === "cancelled" ? "cancelled" : n.status === "valid" ? "pending" : "failed";
  // Only a signed notice may mark a payment failed; an unsigned one changes nothing
  if (n.authentic && outcome !== "pending")
    await markUnpaid(row.id, n.status, { notice: redactNotice(notice) }, source);
  return { outcome, token };
}

const SECRET_FIELDS = new Set(["store_passwd", "mock_sig"]);
const redactNotice = (n: Notice) =>
  Object.fromEntries(Object.entries(n).filter(([k]) => !SECRET_FIELDS.has(k)));

/** A signed failure, cancellation or expiry: the attempt is over, the order can be paid again */
async function markUnpaid(paymentId: number, status: string, data: unknown, source: string) {
  await withTx(async (tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p || p.status !== "initiated") return;
    const cancelled = status === "cancelled";
    await tx
      .update(payments)
      .set({
        status: cancelled ? "cancelled" : "failed",
        raw: withRaw(p.raw, source, data),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
    const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
    if (o && !cancelled && o.paymentStatus === "unpaid")
      await tx
        .update(orders)
        .set({ paymentStatus: "failed", updatedAt: new Date() })
        .where(eq(orders.id, o.id));
    await addEvent(tx, p.orderId, {
      type: "payment",
      actor: "payment",
      message: cancelled
        ? "The customer left the payment page without paying."
        : status === "expired"
          ? "The payment page expired before payment."
          : "The payment didn't go through.",
      data: { tranId: p.tranId },
    });
  });
}

/**
 * The provider's validation, applied: a match makes the payment paid and confirms the order (its
 * held bottles become a sale); anything else is recorded as a failed attempt.
 */
async function applyValidation(
  paymentId: number,
  v: Validation,
  source: string,
): Promise<SettleResult["outcome"]> {
  const r = await withTx(async (tx: Tx) => {
    const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId)).for("update");
    if (!p) return { outcome: "unknown" as const, confirmed: false, orderId: 0 };
    if (p.status === "paid")
      return { outcome: "paid" as const, confirmed: false, orderId: p.orderId };
    const [o] = await tx.select().from(orders).where(eq(orders.id, p.orderId)).for("update");
    if (!o) return { outcome: "unknown" as const, confirmed: false, orderId: 0 };

    const summary = {
      status: v.status,
      amount: v.amount,
      currency: v.currency,
      tranId: v.tranId,
      bankTranId: v.bankTranId,
      method: v.method,
      risky: v.risky,
      riskTitle: v.riskTitle,
      validatedAt: new Date().toISOString(),
      source,
    };
    const why = mismatch(v, { tranId: p.tranId, amount: p.amount });
    if (why) {
      await tx
        .update(payments)
        .set({
          status: "failed",
          validation: { ...summary, accepted: false, reason: why },
          raw: withRaw(p.raw, `${source}-validation`, v.raw),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, p.id));
      if (o.paymentStatus === "unpaid")
        await tx
          .update(orders)
          .set({ paymentStatus: "failed", updatedAt: new Date() })
          .where(eq(orders.id, o.id));
      await addEvent(tx, o.id, {
        type: "payment",
        actor: "payment",
        message: `A payment wasn't accepted: ${why}.`,
        data: { tranId: p.tranId },
      });
      return { outcome: "failed" as const, confirmed: false, orderId: o.id };
    }

    await tx
      .update(payments)
      .set({
        status: "paid",
        valId: v.valId,
        methodReported: v.method,
        validation: { ...summary, accepted: true },
        raw: withRaw(p.raw, `${source}-validation`, v.raw),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, p.id));
    const method = v.method ? ` (${v.method})` : "";
    await addEvent(tx, o.id, {
      type: "payment",
      actor: "payment",
      message: `Paid ${formatPrice(p.amount)}${method}, validated with the provider.`,
      data: { tranId: p.tranId, valId: v.valId },
    });
    if (v.risky)
      await addEvent(tx, o.id, {
        type: "attention",
        actor: "payment",
        message: `The provider flags this payment as risky${v.riskTitle ? ` (${v.riskTitle})` : ""}. Check it before packing.`,
      });

    if (o.paymentStatus === "paid") {
      await addEvent(tx, o.id, {
        type: "attention",
        actor: "payment",
        message: "This order was already paid: a second payment came in. Refund one of them.",
      });
      return { outcome: "paid" as const, confirmed: false, orderId: o.id };
    }
    await tx
      .update(orders)
      .set({ paymentStatus: "paid", updatedAt: new Date() })
      .where(eq(orders.id, o.id));

    let confirmed = false;
    if (o.status === "pending_payment") {
      const label = `Order ${o.number}`;
      try {
        // A savepoint: if the bottles are gone, the payment is still recorded
        await tx.transaction(async (sp) => {
          const held = await commitReservations(sp, o.id, label);
          if (held === 0) {
            const lines = await sp
              .select({ variantId: orderItems.variantId, qty: orderItems.qty })
              .from(orderItems)
              .where(eq(orderItems.orderId, o.id));
            await sellStock(
              sp,
              o.id,
              lines.flatMap((l) => (l.variantId ? [{ variantId: l.variantId, qty: l.qty }] : [])),
              label,
            );
          }
        });
        await transitionOrder(tx, o.id, "confirmed", {
          actor: "payment",
          note: "Payment validated.",
        });
        confirmed = true;
      } catch (e) {
        if (!(e instanceof UserFacingError)) throw e;
        await addEvent(tx, o.id, {
          type: "attention",
          actor: "payment",
          message:
            "Paid, but the bottles sold out while payment was made. Refund it, or restock and confirm it by hand.",
        });
      }
    } else if (o.status === "cancelled") {
      await addEvent(tx, o.id, {
        type: "attention",
        actor: "payment",
        message:
          "Paid after the order had been cancelled (it waited too long). Refund it, or call the customer.",
      });
    }
    return { outcome: "paid" as const, confirmed, orderId: o.id };
  });

  if (r.confirmed) {
    void sendReceipt(r.orderId).catch((e: Error) => console.error("[receipt]", e.message));
    await revalidateStorefront();
  }
  return r.outcome;
}

/**
 * Payments still open after 10 minutes: ask the provider directly, in case both notices were lost
 * (cron). Attempts on orders that are no longer waiting are closed.
 */
export async function reconcilePayments() {
  const open = await poolDb()
    .select({
      id: payments.id,
      tranId: payments.tranId,
      provider: payments.provider,
      orderStatus: orders.status,
      phone: orders.customerPhone,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(
      and(
        eq(payments.status, "initiated"),
        lt(payments.createdAt, sql`now() - interval '10 minutes'`),
        gt(payments.createdAt, sql`now() - interval '3 days'`),
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(100);
  let settled = 0;
  for (const p of open) {
    const provider = providerByName(p.provider);
    let v: Validation | null = null;
    try {
      v = provider ? await provider.getTransaction(p.tranId) : null;
    } catch (e) {
      console.error(
        `[payments] reconcile ${p.tranId} (${maskPhone(p.phone)}):`,
        (e as Error).message,
      );
      continue;
    }
    if (v?.valid) {
      await applyValidation(p.id, v, "reconcile");
      settled++;
    } else if (v && ["FAILED", "CANCELLED", "EXPIRED"].includes(v.status)) {
      await markUnpaid(p.id, v.status.toLowerCase(), { query: v.raw }, "reconcile");
      settled++;
    } else if (p.orderStatus !== "pending_payment") {
      await markUnpaid(p.id, "expired", { reason: "order no longer waiting" }, "reconcile");
      settled++;
    }
  }
  return settled;
}
