import { and, desc, eq, sql } from "drizzle-orm";
import { orders, shipments } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { manualTrackingUrl } from "./shipment-meta";
import { trackingUrl } from "./tracking";
import { CANCELLED_HERE } from "./types";

/** The tracking link for an order's latest parcel, if its courier has public tracking */
export async function orderTracking(orderId: number, exec: Executor = poolDb()) {
  const [row] = await exec
    .select({ s: shipments, phone: orders.customerPhone })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(
      and(
        eq(shipments.orderId, orderId),
        sql`${shipments.status} not in (${CANCELLED_HERE}, 'creating')`,
      ),
    )
    .orderBy(desc(shipments.id))
    .limit(1);
  if (!row) return null;
  return {
    courier: row.s.courier,
    trackingCode: row.s.trackingCode,
    url:
      row.s.courier === "manual"
        ? manualTrackingUrl(row.s)
        : trackingUrl(row.s.courier, row.s.trackingCode, row.phone),
  };
}
