import { firstDelivery, settleNotice } from "@/server/payments/service";
import { isProviderName, readNotice } from "@/server/payments/http";

// The provider's server-to-server notice (IPN). Authenticity comes from the provider's validation
// API (and, for failures, its signature). A repeat of the same notice is acknowledged and ignored.
// Any error answers 500, so the provider tries again.

export async function POST(req: Request, ctx: RouteContext<"/api/payments/ipn/[provider]">) {
  const { provider } = await ctx.params;
  if (!isProviderName(provider)) return new Response("Not found", { status: 404 });
  const notice = await readNotice(req);
  if (!notice.tran_id) return new Response("Missing tran_id", { status: 400 });
  try {
    const eventId = `${notice.tran_id}:${notice.status ?? ""}:${notice.val_id ?? ""}`;
    if (await firstDelivery(`${provider}-ipn`, eventId))
      await settleNotice(provider, notice, "ipn");
    return new Response("OK", { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[payments] ipn failed", e);
    return new Response("Error", { status: 500 });
  }
}
