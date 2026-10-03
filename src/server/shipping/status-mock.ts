import type { MappedStatus } from "./types";

/** The test courier's statuses (the admin sends them by hand) → ZALFI's order states */
export const MOCK_STATUSES = {
  awaiting_pickup: { label: "Waiting for pickup", order: "packed", final: false },
  picked_up: { label: "Picked up", order: "shipped", final: false },
  in_transit: { label: "On the way", order: "shipped", final: false },
  out_for_delivery: { label: "Out for delivery", order: "out_for_delivery", final: false },
  delivered: { label: "Delivered", order: "delivered", final: true },
  delivery_failed: {
    label: "Delivery failed",
    order: "delivery_failed",
    final: false,
    failedAttempt: true,
  },
  returning: {
    label: "On its way back",
    order: "delivery_failed",
    final: false,
    attention: "The parcel is coming back. Mark the order returned once it arrives.",
  },
  returned: {
    label: "Returned to you",
    order: "delivery_failed",
    final: true,
    attention: "The courier has returned the parcel. Check it, then mark the order returned.",
  },
  cancelled: {
    label: "Cancelled by the courier",
    order: null,
    final: true,
    attention: "The courier cancelled this parcel. Send it again or cancel the order.",
  },
} as const satisfies Record<string, MappedStatus>;

export type MockStatus = keyof typeof MOCK_STATUSES;

export const mapMock = (s: string): MappedStatus =>
  MOCK_STATUSES[s as MockStatus] ?? { label: s, order: null, final: false };
