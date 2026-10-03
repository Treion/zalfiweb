import { authorisedCron } from "@/server/cron";
import { pollShipments } from "@/server/shipping/service";

// Vercel Cron (vercel.json), every 30 minutes: ask each courier about its parcels still under way,
// in case a webhook was missed. Protected by CRON_SECRET.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorisedCron(req)) return new Response("Unauthorised", { status: 401 });
  return Response.json({ changed: await pollShipments() });
}
