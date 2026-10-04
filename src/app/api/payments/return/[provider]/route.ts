import { confirmationUrl, settleNotice } from "@/server/payments/service";
import { isProviderName, readNotice, withCallbackParams } from "@/server/payments/http";
import type { Notice } from "@/server/payments/types";

// The customer's browser coming back from the payment page (success, fail or cancel address). The
// notice it carries is checked with the provider exactly like an IPN; the browser's word alone
// never marks anything paid, or failed. Then the customer lands on their order's page.

async function settle(provider: string, notice: Notice, req: Request) {
  if (!isProviderName(provider)) return new Response("Not found", { status: 404 });
  let result: Awaited<ReturnType<typeof settleNotice>>;
  try {
    result = await settleNotice(provider, withCallbackParams(notice, req.url), "return");
  } catch (e) {
    console.error("[payments] return failed", e);
    result = { outcome: "pending", token: null };
  }
  const to = result.token ? confirmationUrl(result.token, result.outcome) : "/";
  return Response.redirect(new URL(to, req.url), 303);
}

export async function POST(req: Request, ctx: RouteContext<"/api/payments/return/[provider]">) {
  const { provider } = await ctx.params;
  return settle(provider, await readNotice(req), req);
}

// A plain visit: aamarPay's cancel address arrives this way, with nothing but our own parameters.
// Without a transaction, there is nothing to settle.
export async function GET(req: Request, ctx: RouteContext<"/api/payments/return/[provider]">) {
  const { provider } = await ctx.params;
  if (!new URL(req.url).searchParams.get("tran"))
    return Response.redirect(new URL("/", req.url), 303);
  return settle(provider, {}, req);
}
