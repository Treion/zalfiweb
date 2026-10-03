import { asc, eq } from "drizzle-orm";
import { orderItems, orders } from "@/db/schema";
import { poolDb } from "@/server/db/pool";

/**
 * The customer's view of their own order, opened with the order's access token (a random secret
 * only their browser received). Shows nothing else about anyone.
 */
export async function orderForCustomer(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = poolDb();
  const [o] = await db.select().from(orders).where(eq(orders.accessToken, token)).limit(1);
  if (!o) return null;
  const items = await db
    .select({
      name: orderItems.name,
      sizeMl: orderItems.sizeMl,
      qty: orderItems.qty,
      lineTotal: orderItems.lineTotal,
      fragranceId: orderItems.fragranceId,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, o.id))
    .orderBy(asc(orderItems.id));
  return { order: o, items };
}
