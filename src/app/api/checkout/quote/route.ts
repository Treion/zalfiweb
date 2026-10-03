import { quoteSchema } from "@/lib/checkout";
import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { quoteBag } from "@/server/checkout/quote";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, phoneFromCookie, readBody } from "@/server/checkout/http";

// Prices the bag for the checkout page: today's prices, stock, the coupon, the shipping fee for the
// address so far, and the total. Coupon checks are rate-limited per IP.

export async function POST(req: Request) {
  try {
    const input = await readBody(req, quoteSchema);
    if (input.coupon) {
      const ip = clientIp(req.headers);
      const r = await hit(`coupon:ip:${ip ?? "unknown"}`, 30, 10 * 60);
      if (!r.ok) throw new TooManyRequests("Too many codes tried. Wait a little.", r.retryAfter);
    }
    const quote = await quoteBag(input, await phoneFromCookie());
    return Response.json(quote, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
