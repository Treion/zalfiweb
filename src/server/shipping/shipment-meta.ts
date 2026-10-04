import type { shipments } from "@/db/schema";
import { COURIER_LABELS } from "./types";

type Shipment = Pick<typeof shipments.$inferSelect, "courier" | "raw">;

/** What the team typed when sending with "Other courier" (kept with the parcel's create record) */
function manualDetails(s: Shipment) {
  if (s.courier !== "manual") return null;
  const created = (Array.isArray(s.raw) ? s.raw : []).find(
    (r: { source?: string }) => r?.source === "create",
  ) as { data?: { response?: { courierName?: string; trackingUrl?: string | null } } } | undefined;
  return created?.data?.response ?? null;
}

/** The courier's name for a parcel: the one the team typed for "Other courier" */
export const shipmentLabel = (s: Shipment) =>
  manualDetails(s)?.courierName ?? COURIER_LABELS[s.courier];

/** The tracking link the team saved for a parcel sent with another courier */
export const manualTrackingUrl = (s: Shipment) => manualDetails(s)?.trackingUrl ?? null;
