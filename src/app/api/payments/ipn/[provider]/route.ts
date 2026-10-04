import { firstDelivery, settleNotice } from "@/server/payments/service";
import { isProviderName, readNotice } from "@/server/payments/http";

// The provider's server-to-server notice (IPN). Authenticity comes from the provider's validation
// API (and, for failures, its signature or its transaction check). A repeat of the same notice is acknowledged and ignored.
// Any error answers 500, so the provider tries again.

export async function POST(req: Request, ctx: RouteContext<"/api/payments/ipn/[provider]">) {
  const { provider } = await ctx.params;
  if (!isProviderName(provider)) return new Response("Not found", { status: 404 });
  const notice = await readNotice(req);
  // SSLCommerz names the transaction tran_id; aamarPay, mer_txnid
  const tran = notice.tran_id ?? notice.mer_txnid;
  if (!tran) return new Response("Missing transaction ID", { status: 400 });
  try {
    const status = notice.status ?? notice.pay_status ?? "";
    const eventId = `${tran}:${status}:${notice.val_id ?? notice.pg_txnid ?? ""}`;
    if (await firstDelivery(`${provider}-ipn`, eventId))
      await settleNotice(provider, notice, "ipn");
    return new Response("OK", { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[payments] ipn failed", e);
    return new Response("Error", { status: 500 });
  }
}
