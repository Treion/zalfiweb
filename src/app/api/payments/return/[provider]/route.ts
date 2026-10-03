import { confirmationUrl, settleNotice } from "@/server/payments/service";
import { isProviderName, readNotice } from "@/server/payments/http";

// The customer's browser coming back from the payment page (success, fail or cancel URL). The
// notice it carries is checked with the provider exactly like an IPN; the browser's word alone
// never marks anything paid. Then the customer lands on their order's page.

export async function POST(req: Request, ctx: RouteContext<"/api/payments/return/[provider]">) {
  const { provider } = await ctx.params;
  if (!isProviderName(provider)) return new Response("Not found", { status: 404 });
  const notice = await readNotice(req);
  let result: Awaited<ReturnType<typeof settleNotice>>;
  try {
    result = await settleNotice(provider, notice, "return");
  } catch (e) {
    console.error("[payments] return failed", e);
    result = { outcome: "pending", token: null };
  }
  const to = result.token ? confirmationUrl(result.token, result.outcome) : "/";
  return Response.redirect(new URL(to, req.url), 303);
}

// A plain visit (no notice): nothing to settle
export function GET(req: Request) {
  return Response.redirect(new URL("/", req.url), 303);
}
