import { releaseExpiredReservations } from "@/server/catalog/stock";
import { authorisedCron } from "@/server/cron";
import { poolDb } from "@/server/db/pool";
import { expireUnpaidOrders } from "@/server/orders/manage";

// Vercel Cron (vercel.json): every 10 minutes, cancel unpaid online orders past their expiry and
// mark any other lapsed stock holds released. Availability already ignores expired holds, so this
// is housekeeping, never a source of overselling. Protected by CRON_SECRET.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorisedCron(req)) return new Response("Unauthorised", { status: 401 });
  const expired = await expireUnpaidOrders();
  const released = await releaseExpiredReservations(poolDb());
  return Response.json({ expired, released: released.length });
}
