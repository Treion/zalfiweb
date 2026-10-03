import { releaseExpiredReservations } from "@/server/catalog/stock";
import { authorisedCron } from "@/server/cron";
import { poolDb } from "@/server/db/pool";

// Vercel Cron (vercel.json): every 10 minutes, mark lapsed stock reservations released.
// Availability already ignores expired reservations; this keeps the table tidy and is where unpaid
// orders will be expired too (phase 4). Protected by CRON_SECRET.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorisedCron(req)) return new Response("Unauthorised", { status: 401 });
  const orders = await releaseExpiredReservations(poolDb());
  return Response.json({ released: orders.length });
}
