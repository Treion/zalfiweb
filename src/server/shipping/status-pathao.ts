import type { MappedStatus } from "./types";

/**
 * Pathao's statuses → ZALFI's order states. Pathao reports a status slug from the order info API
 * ("Pickup_Requested", "At_the_Sorting_HUB", …) and an event name in webhooks ("order.picked",
 * "order.delivery-failed", …). Both are normalised to lower_snake_case first.
 */
const awaiting = { label: "Waiting for pickup", order: "packed", final: false } as const;
const moving = (label: string) => ({ label, order: "shipped", final: false }) as const;

const MAP: Record<string, MappedStatus> = {
  created: awaiting,
  pending: awaiting,
  pickup_requested: awaiting,
  assigned_for_pickup: { ...awaiting, label: "Rider on the way to pick up" },
  pickup_failed: {
    ...awaiting,
    label: "Pickup failed",
    attention: "Pathao couldn't pick the parcel up. They will try again.",
  },
  pickup_cancelled: {
    label: "Pickup cancelled",
    order: null,
    final: true,
    attention: "Pathao cancelled the pickup. Send the parcel again or cancel the order.",
  },
  picked: moving("Picked up"),
  at_the_sorting_hub: moving("At the sorting hub"),
  in_transit: moving("On the way"),
  received_at_last_mile_hub: moving("At the local hub"),
  assigned_for_delivery: { label: "Out for delivery", order: "out_for_delivery", final: false },
  delivered: { label: "Delivered", order: "delivered", final: true },
  partial_delivery: {
    label: "Partly delivered",
    order: "delivered",
    final: true,
    attention: "Pathao reports a partial delivery. Check what the customer kept.",
  },
  delivery_failed: {
    label: "Delivery failed",
    order: "delivery_failed",
    final: false,
    failedAttempt: true,
  },
  on_hold: {
    label: "On hold",
    order: null,
    final: false,
    attention: "Pathao has put the parcel on hold. Call the customer.",
  },
  return: {
    label: "On its way back",
    order: "delivery_failed",
    final: false,
    attention: "The parcel is coming back. Mark the order returned once it arrives.",
  },
  returned: {
    label: "Returned to you",
    order: "delivery_failed",
    final: true,
    attention: "Pathao has returned the parcel. Check it, then mark the order returned.",
  },
  paid_return: {
    label: "Returned to you",
    order: "delivery_failed",
    final: true,
    attention: "Pathao has returned the parcel. Check it, then mark the order returned.",
  },
  // Settlement and bookkeeping events: the parcel's state doesn't change
  paid: { label: "Paid out by Pathao", order: null, final: true },
  payment_invoice: { label: "Paid out by Pathao", order: null, final: true },
  updated: { label: "Updated", order: null, final: false },
  exchanged: {
    label: "Exchanged",
    order: null,
    final: true,
    attention: "Pathao reports an exchange. Check the order.",
  },
};

export const normalisePathao = (s: string) =>
  s
    .trim()
    .replace(/^order\./i, "")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

export const mapPathao = (s: string): MappedStatus =>
  MAP[normalisePathao(s)] ?? { label: s.replace(/_/g, " "), order: null, final: false };
