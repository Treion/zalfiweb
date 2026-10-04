import type { MappedStatus } from "./types";

/**
 * RedX's parcel statuses → ZALFI's order states. Webhooks and the parcel info API both report
 * them in kebab-case ("ready-for-delivery", "delivery-in-progress", …); anything else is read
 * after normalising to that form.
 */
const awaiting = { label: "Waiting for pickup", order: "packed", final: false } as const;

const MAP: Record<string, MappedStatus> = {
  "pickup-pending": awaiting,
  "pickup-requested": awaiting,
  "pickup-assigned": { ...awaiting, label: "Rider on the way to pick up" },
  "picked-up": { label: "Picked up", order: "shipped", final: false },
  "ready-for-delivery": { label: "At the RedX hub", order: "shipped", final: false },
  "in-transit": { label: "On the way", order: "shipped", final: false },
  "delivery-in-progress": { label: "Out for delivery", order: "out_for_delivery", final: false },
  delivered: { label: "Delivered", order: "delivered", final: true },
  "agent-hold": {
    label: "On hold at RedX",
    order: null,
    final: false,
    attention: "RedX is holding the parcel (the customer couldn't be reached). Call the customer.",
  },
  "agent-area-change": {
    label: "Area change in progress",
    order: null,
    final: false,
    attention: "RedX is changing the delivery area. Check the address with the customer.",
  },
  "agent-returning": {
    label: "On its way back",
    order: "delivery_failed",
    final: false,
    attention: "The parcel is coming back. Mark the order returned once it arrives.",
  },
  returned: {
    label: "Returned to you",
    order: "delivery_failed",
    final: true,
    attention: "RedX has returned the parcel. Check it, then mark the order returned.",
  },
  cancelled: {
    label: "Cancelled",
    order: null,
    final: true,
    attention: "This RedX parcel was cancelled. Send it again or cancel the order.",
  },
};

export const normaliseRedx = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

export function mapRedx(status: string): MappedStatus {
  const s = normaliseRedx(status);
  return MAP[s] ?? { label: status.replace(/-/g, " "), order: null, final: false };
}
