import type { MappedStatus } from "./types";

/**
 * CarryBee's parcel statuses → ZALFI's order states. Webhooks name them as events
 * ("order.picked", "order.assigned-for-delivery", …); the order details API reports a
 * `transfer_status`. Both are read after normalising to the event's kebab-case, without "order.".
 */
const awaiting = { label: "Waiting for pickup", order: "packed", final: false } as const;
const moving = (label: string) => ({ label, order: "shipped", final: false }) as const;
const comingBack = {
  label: "On its way back",
  order: "delivery_failed",
  final: false,
  attention: "The parcel is coming back. Mark the order returned once it arrives.",
} as const;

const MAP: Record<string, MappedStatus> = {
  created: awaiting,
  "pickup-requested": awaiting,
  "assigned-for-pickup": { ...awaiting, label: "Rider on the way to pick up" },
  "pickup-failed": {
    label: "Pickup failed",
    order: null,
    final: false,
    attention: "CarryBee couldn't pick the parcel up. Check the pickup store and the parcel.",
  },
  "pickup-cancelled": {
    label: "Cancelled",
    order: null,
    final: true,
    attention: "This CarryBee parcel was cancelled. Send it again or cancel the order.",
  },
  picked: moving("Picked up"),
  "at-the-sorting-hub": moving("At the sorting hub"),
  "on-the-way-to-central-warehouse": moving("On the way to the central warehouse"),
  "at-central-warehouse": moving("At the central warehouse"),
  "in-transit": moving("On the way"),
  "received-at-last-mile-hub": moving("At the local hub"),
  "assigned-for-delivery": { label: "Out for delivery", order: "out_for_delivery", final: false },
  "delivery-on-hold": {
    label: "On hold at CarryBee",
    order: null,
    final: false,
    attention:
      "CarryBee is holding the parcel (the customer couldn't be reached). Call the customer.",
  },
  delivered: { label: "Delivered", order: "delivered", final: true },
  "partial-delivery": {
    label: "Partly delivered",
    order: "delivered",
    final: true,
    attention: "CarryBee reports a partial delivery. Check what the customer kept.",
  },
  "delivery-failed": {
    label: "Delivery failed",
    order: "delivery_failed",
    final: false,
    failedAttempt: true,
  },
  returned: comingBack,
  "returned-at-sorting": comingBack,
  "returned-in-transit": comingBack,
  "paid-return": {
    ...comingBack,
    attention:
      "The customer paid the delivery charge and refused the parcel. Mark the order returned once it arrives.",
  },
  "returned-to-merchant": {
    label: "Returned to you",
    order: "delivery_failed",
    final: true,
    attention: "CarryBee has returned the parcel. Check it, then mark the order returned.",
  },
  exchange: { label: "Exchanged", order: null, final: false },
  paid: { label: "Cash paid out by CarryBee", order: null, final: false },
  updated: { label: "Details updated", order: null, final: false },
};

export const normaliseCarrybee = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/^order\./, "")
    .replace(/[\s_]+/g, "-");

export function mapCarrybee(status: string): MappedStatus {
  const s = normaliseCarrybee(status);
  return MAP[s] ?? { label: s.replace(/-/g, " "), order: null, final: false };
}
