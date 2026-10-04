import { getIntegration } from "@/server/integrations";
import { CARRYBEE_WEBHOOK_HEADER } from "@/server/shipping/carrybee";
import { handleCourierWebhook } from "@/server/shipping/service";

// Courier status webhooks (Pathao, Steadfast, RedX, CarryBee). Each courier proves it is itself:
// Pathao sends the secret set in its panel (X-PATHAO-Signature), Steadfast our token as a Bearer
// header, RedX our token in this address, CarryBee the secret from its Webhook Integration page
// (X-CB-Webhook-Integration-Header). The status is then re-read from the courier's API where it has one.
// Repeats change nothing. Set-up for each lives in Admin → Integrations.

const HOOKED = new Set(["pathao", "steadfast", "redx", "carrybee"]);

export async function POST(req: Request, ctx: RouteContext<"/api/couriers/webhook/[courier]">) {
  const { courier } = await ctx.params;
  if (!HOOKED.has(courier)) return new Response("Not found", { status: 404 });
  const body = await req.json().catch(() => null);
  let code: number;
  try {
    code = await handleCourierWebhook(courier, req.headers, body, new URL(req.url));
  } catch (e) {
    console.error(`[shipping] ${courier} webhook failed`, e);
    return new Response("Error", { status: 500 });
  }
  if (courier === "pathao" && code === 200) {
    // Pathao's integration check expects 202 and this header back (the value from its panel)
    const secret = (await getIntegration("pathao")).values.integrationSecret;
    return new Response(null, {
      status: 202,
      headers: secret ? { "X-Pathao-Merchant-Webhook-Integration-Secret": secret } : {},
    });
  }
  if (courier === "carrybee" && code === 200) {
    // CarryBee's integration check expects 202 and its secret echoed back
    const secret = (await getIntegration("carrybee")).values.webhookSecret;
    return new Response(null, {
      status: 202,
      headers: secret ? { [CARRYBEE_WEBHOOK_HEADER]: secret } : {},
    });
  }
  if (code === 200)
    return Response.json({ status: "success", message: "Webhook received successfully." });
  return new Response(code === 401 ? "Unauthorised" : "Not found", { status: code });
}
