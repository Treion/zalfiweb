import { authorisedCron } from "@/server/cron";
import { reconcilePayments } from "@/server/payments/service";
import { refreshPendingRefunds } from "@/server/payments/refunds";

// Vercel Cron (vercel.json), every 30 minutes: ask the provider about payments still open (in case
// both its notices were lost) and about refunds still processing. Protected by CRON_SECRET.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!authorisedCron(req)) return new Response("Unauthorised", { status: 401 });
  const settled = await reconcilePayments();
  const refunds = await refreshPendingRefunds();
  return Response.json({ settled, refunds });
}
