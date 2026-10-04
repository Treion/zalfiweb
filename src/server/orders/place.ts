import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { customerAddresses, customers, orderItems, orders } from "@/db/schema";
import { PAYMENT_LABELS, type placeOrderSchema } from "@/lib/checkout";
import { poolDb, withTx } from "@/server/db/pool";
import { isUniqueViolation } from "@/server/db/errors";
import { UserFacingError } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { reserveStock, sellStock } from "@/server/catalog/stock";
import { applyCoupon, checkoutMethods, priceBag, shippingRules } from "@/server/checkout/quote";
import { confirmationUrl, startPayment } from "@/server/payments/service";
import { shippingZone, totals } from "@/server/checkout/pricing";
import { revalidateStorefront } from "@/server/catalog/products";
import { addEvent } from "./events";
import { sendReceipt } from "./receipt";

export type PlacedOrder = {
  number: string;
  accessToken: string;
  status: "pending_payment" | "confirmed";
  /** Where the customer goes next */
  next: string;
};

/** The total changed between the quote and placing the order (a price or the coupon changed) */
export class TotalChanged extends UserFacingError {
  constructor(readonly total: number) {
    super("Your total has changed. Check it, then place the order again.");
  }
}

async function byIdempotencyKey(key: string): Promise<PlacedOrder | null> {
  const [o] = await poolDb()
    .select({ number: orders.number, accessToken: orders.accessToken, status: orders.status })
    .from(orders)
    .where(eq(orders.idempotencyKey, key))
    .limit(1);
  if (!o) return null;
  return {
    number: o.number,
    accessToken: o.accessToken,
    status: o.status === "pending_payment" ? "pending_payment" : "confirmed",
    next: confirmationUrl(o.accessToken),
  };
}

/**
 * Places a guest order. Everything is recomputed here: prices, stock, the coupon, the shipping fee
 * and the total. In one transaction it saves the customer, the order and its lines, then either
 * sells the stock (cash on delivery: the order is confirmed) or reserves it until the unpaid-order
 * expiry (online payment, or bKash or Nagad by hand), and for online payment opens the payment
 * page. The same idempotency key
 * always returns the same order.
 */
export async function placeOrder(
  input: z.output<typeof placeOrderSchema>,
  verifiedPhone: string | null,
): Promise<PlacedOrder> {
  const existing = await byIdempotencyKey(input.idempotencyKey);
  if (existing) return existing;

  if (verifiedPhone !== input.phone)
    throw new UserFacingError("Verify your phone number to place the order.");

  const [ship, { pay, methods }] = await Promise.all([getSettings("shipping"), checkoutMethods()]);
  if (!methods.includes(input.paymentMethod))
    throw new UserFacingError(`${PAYMENT_LABELS[input.paymentMethod]} isn't available right now.`);
  const rules = shippingRules(ship);
  const cod = input.paymentMethod === "cod";
  const manual = input.paymentMethod === "manual";
  // Online payment holds the bottles for minutes; bKash or Nagad by hand, for hours
  const holdMinutes = manual ? pay.manual.holdHours * 60 : pay.unpaidExpiryMinutes;

  let placed: PlacedOrder;
  try {
    placed = await withTx(async (tx) => {
      const { lines, unavailable } = await priceBag(tx, input.items, true);
      if (unavailable.length || lines.length !== new Set(input.items.map((i) => i.sku)).size)
        throw new UserFacingError("Something in your bag has just sold out. Check your bag.");
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

      // The coupon row is locked, so two orders can't both take its last use
      let discount = 0;
      let freeShipping = false;
      let couponId: number | null = null;
      if (input.coupon) {
        const { row, result } = await applyCoupon(
          tx,
          input.coupon,
          lines,
          subtotal,
          input.phone,
          true,
        );
        if (!result.ok) throw new UserFacingError(result.message);
        discount = result.discount;
        freeShipping = result.freeShipping;
        couponId = row!.id;
      }

      const zone = shippingZone(input.district, input.area, rules);
      const t = totals(subtotal, discount, zone, rules, freeShipping);
      if (t.total !== input.expectedTotal) throw new TotalChanged(t.total);

      const [customer] = await tx
        .insert(customers)
        .values({ phone: input.phone, name: input.name, email: input.email })
        .onConflictDoUpdate({
          target: customers.phone,
          set: { name: input.name, email: input.email, updatedAt: new Date() },
        })
        .returning({ id: customers.id });
      const [sameAddress] = await tx
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(
          and(
            eq(customerAddresses.customerId, customer!.id),
            eq(customerAddresses.district, input.district),
            sql`lower(${customerAddresses.area}) = lower(${input.area})`,
            sql`lower(${customerAddresses.street}) = lower(${input.street})`,
          ),
        )
        .limit(1);
      if (!sameAddress)
        await tx.insert(customerAddresses).values({
          customerId: customer!.id,
          district: input.district,
          area: input.area,
          street: input.street,
          zone,
        });

      const now = new Date();
      const expiresAt = cod ? null : new Date(now.getTime() + holdMinutes * 60_000);
      const [order] = await tx
        .insert(orders)
        .values({
          idempotencyKey: input.idempotencyKey,
          accessToken: randomBytes(24).toString("base64url"),
          customerId: customer!.id,
          customerName: input.name,
          customerPhone: input.phone,
          customerEmail: input.email,
          addressDistrict: input.district,
          addressArea: input.area,
          addressStreet: input.street,
          zone,
          ...t,
          couponId,
          couponCode: couponId ? input.coupon!.toUpperCase() : null,
          paymentMethod: input.paymentMethod,
          status: cod ? "confirmed" : "pending_payment",
          confirmedAt: cod ? now : null,
          expiresAt,
        })
        .returning({ id: orders.id, number: orders.number, accessToken: orders.accessToken });
      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order!.id,
          variantId: l.variantId,
          fragranceId: l.fragranceId,
          sku: l.sku,
          name: l.name,
          sizeMl: l.sizeMl,
          unitPrice: l.unitPrice,
          qty: l.qty,
          lineTotal: l.lineTotal,
        })),
      );

      const stockLines = lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
      if (cod) await sellStock(tx, order!.id, stockLines, `Order ${order!.number}`);
      else await reserveStock(tx, order!.id, stockLines, expiresAt!);

      await addEvent(tx, order!.id, {
        type: "placed",
        to: cod ? "confirmed" : "pending_payment",
        actor: "customer",
        message: cod
          ? "Order placed, cash on delivery."
          : manual
            ? `Order placed, to be paid by bKash or Nagad. Stock held for ${pay.manual.holdHours} hours for the transaction ID.`
            : `Order placed. Stock held for ${pay.unpaidExpiryMinutes} minutes while payment is made.`,
        data: { total: t.total, coupon: couponId ? input.coupon : null },
      });
      return {
        number: order!.number,
        accessToken: order!.accessToken,
        status: cod ? ("confirmed" as const) : ("pending_payment" as const),
        next: confirmationUrl(order!.accessToken),
        id: order!.id,
      };
    }).then(async ({ id, ...p }) => {
      if (cod) {
        void sendReceipt(id).catch((e: Error) => console.error("[receipt]", e.message));
        return p;
      }
      // bKash or Nagad: the order's page shows where to send the money, and takes the TrxID
      if (manual) return p;
      // Online: straight to the payment page. If it can't open, the order's page offers "Pay now".
      try {
        return { ...p, next: await startPayment(id) };
      } catch {
        return p;
      }
    });
  } catch (e) {
    // The same checkout submitted twice at once: the second insert hits the unique key
    if (isUniqueViolation(e)) {
      const again = await byIdempotencyKey(input.idempotencyKey);
      if (again) return again;
    }
    throw e;
  }
  await revalidateStorefront();
  return placed;
}
