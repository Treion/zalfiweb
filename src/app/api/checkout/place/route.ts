import { placeOrderSchema } from "@/lib/checkout";
import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { TotalChanged, placeOrder } from "@/server/orders/place";
import { errorResponse, noStore, phoneFromCookie, readBody } from "@/server/checkout/http";

// Places the order. The phone must be verified in this browser; everything else (prices, stock,
// coupon, shipping, total) is recomputed on the server. The idempotency key makes a double submit
// return the same order.

export async function POST(req: Request) {
  try {
    const input = await readBody(req, placeOrderSchema);
    const ip = clientIp(req.headers);
    const r = await hit(`checkout:ip:${ip ?? "unknown"}`, 20, 10 * 60);
    if (!r.ok) throw new TooManyRequests("Too many attempts. Wait a little.", r.retryAfter);
    const placed = await placeOrder(input, await phoneFromCookie());
    return Response.json(placed, { headers: noStore });
  } catch (e) {
    if (e instanceof TotalChanged)
      return Response.json({ error: e.message, total: e.total }, { status: 409, headers: noStore });
    return errorResponse(e);
  }
}
