/**
 * The order lifecycle, in one place. The server refuses any status change not listed here.
 *
 *   pending_payment → confirmed → packed → shipped → out_for_delivery → delivered
 *
 *   cancelled         from pending_payment, confirmed or packed
 *   delivery_failed   from shipped or out_for_delivery; then shipped again (re-attempt) or returned
 *   return_requested  from delivered; then returned, or back to delivered (the request is declined)
 *
 * Payment status is tracked separately (PAYMENT_TRANSITIONS).
 */

export const ORDER_STATUSES = [
  "pending_payment",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "delivery_failed",
  "return_requested",
  "returned",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  // Some couriers report delivery without an "out for delivery" step
  shipped: ["out_for_delivery", "delivered", "delivery_failed"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivery_failed: ["shipped", "returned"],
  delivered: ["return_requested"],
  return_requested: ["returned", "delivered"],
  cancelled: [],
  returned: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

export class InvalidTransition extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(
      `An order that is ${STATUS_LABELS[from].toLowerCase()} can't become ${STATUS_LABELS[to].toLowerCase()}.`,
    );
  }
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) throw new InvalidTransition(from, to);
}

/** The timestamp column each status sets when an order enters it */
export const STATUS_TIMESTAMP = {
  pending_payment: null,
  confirmed: "confirmedAt",
  packed: "packedAt",
  shipped: "shippedAt",
  out_for_delivery: "outForDeliveryAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
  delivery_failed: "deliveryFailedAt",
  return_requested: "returnRequestedAt",
  returned: "returnedAt",
} as const satisfies Record<OrderStatus, string | null>;

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  delivery_failed: "Delivery failed",
  return_requested: "Return requested",
  returned: "Returned",
};

/** Orders holding stock that a cancellation should offer to put back */
export const SOLD_STATUSES: readonly OrderStatus[] = ["confirmed", "packed"];

/** Still moving: not yet delivered, cancelled or returned */
export const OPEN_STATUSES: readonly OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivery_failed",
  "return_requested",
];

/* ---------------------------------------------------------------------------------------------- */
/* Payment status                                                                                  */

export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "failed",
  "partially_refunded",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  unpaid: ["paid", "failed"],
  // A failed attempt can be retried
  failed: ["paid", "failed"],
  paid: ["partially_refunded", "refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  refunded: [],
};

export const canPaymentTransition = (from: PaymentStatus, to: PaymentStatus) =>
  PAYMENT_TRANSITIONS[from].includes(to);

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  failed: "Failed",
  partially_refunded: "Partly refunded",
  refunded: "Refunded",
};
