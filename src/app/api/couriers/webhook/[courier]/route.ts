import { env } from "@/lib/env";
import { handleCourierWebhook } from "@/server/shipping/service";

// Courier status webhooks (Pathao, Steadfast). Each courier proves it is itself: Pathao sends the
// secret we set in its panel (X-PATHAO-Signature), Steadfast our token as a Bearer header. The
// status is then re-read from the courier's API where it has one. Repeats change nothing.

export async function POST(req: Request, ctx: RouteContext<"/api/couriers/webhook/[courier]">) {
  const { courier } = await ctx.params;
  if (courier !== "pathao" && courier !== "steadfast")
    return new Response("Not found", { status: 404 });
  const body = await req.json().catch(() => null);
  let code: number;
  try {
    code = await handleCourierWebhook(courier, req.headers, body);
  } catch (e) {
    console.error(`[shipping] ${courier} webhook failed`, e);
    return new Response("Error", { status: 500 });
  }
  if (courier === "pathao" && code === 200) {
    // Pathao's integration check expects 202 and this header back (value from its panel)
    const secret = env("PATHAO_WEBHOOK_INTEGRATION_SECRET");
    return new Response(null, {
      status: 202,
      headers: secret ? { "X-Pathao-Merchant-Webhook-Integration-Secret": secret } : {},
    });
  }
  if (code === 200)
    return Response.json({ status: "success", message: "Webhook received successfully." });
  return new Response(code === 401 ? "Unauthorised" : "Not found", { status: code });
}
