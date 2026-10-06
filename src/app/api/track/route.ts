import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody } from "@/server/checkout/http";
import { UserFacingError } from "@/server/errors";
import { findOrderPage, trackSchema } from "@/server/orders/track";

// "Track your order": the order number and the phone it was placed with lead to the order's own
// page. Rate-limited, and a miss never says which of the two didn't match.

export async function POST(req: Request) {
  try {
    const body = await readBody(req, trackSchema);
    const r = await hit(`track:ip:${clientIp(req.headers) ?? "unknown"}`, 12, 15 * 60);
    if (!r.ok) throw new TooManyRequests("Too many tries. Wait a few minutes.", r.retryAfter);
    const next = await findOrderPage(body.number, body.phone);
    if (!next)
      throw new UserFacingError(
        "We couldn't find that order. Check the number on your receipt or SMS, and the phone you ordered with.",
      );
    return Response.json({ next }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
