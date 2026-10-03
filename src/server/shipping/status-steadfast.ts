import type { MappedStatus } from "./types";

/**
 * Steadfast's delivery statuses → ZALFI's order states. "…_approval_pending" means the rider has
 * reported it and Steadfast hasn't approved it yet; the parcel's state is already real.
 */
const MAP: Record<string, MappedStatus> = {
  in_review: { label: "Waiting for pickup", order: "packed", final: false },
  pending: { label: "On the way", order: "shipped", final: false },
  hold: {
    label: "On hold",
    order: "shipped",
    final: false,
    attention: "Steadfast has put the parcel on hold. Call the customer.",
  },
  delivered_approval_pending: { label: "Delivered", order: "delivered", final: false },
  delivered: { label: "Delivered", order: "delivered", final: true },
  partial_delivered_approval_pending: {
    label: "Partly delivered",
    order: "delivered",
    final: false,
    attention: "Steadfast reports a partial delivery. Check what the customer kept.",
  },
  partial_delivered: {
    label: "Partly delivered",
    order: "delivered",
    final: true,
    attention: "Steadfast reports a partial delivery. Check what the customer kept.",
  },
  cancelled_approval_pending: {
    label: "Delivery cancelled",
    order: "delivery_failed",
    final: false,
    failedAttempt: true,
  },
  cancelled: {
    label: "Delivery cancelled, coming back",
    order: "delivery_failed",
    final: true,
    failedAttempt: true,
    attention:
      "Steadfast couldn't deliver and is returning the parcel. Mark the order returned once it arrives.",
  },
  unknown_approval_pending: {
    label: "Unclear",
    order: null,
    final: false,
    attention: "Steadfast reports an unclear status. Check with them.",
  },
  unknown: {
    label: "Unclear",
    order: null,
    final: false,
    attention: "Steadfast reports an unclear status. Check with them.",
  },
};

export const mapSteadfast = (s: string): MappedStatus =>
  MAP[s.trim().toLowerCase()] ?? { label: s.replace(/_/g, " "), order: null, final: false };
