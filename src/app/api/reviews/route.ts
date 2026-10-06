import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody } from "@/server/checkout/http";
import { reviewInputSchema } from "@/lib/reviews";
import { submitReview } from "@/server/reviews";

// A buyer's review of one line of their delivered order, sent from the order's own page (the
// access token proves it's theirs). It waits for the team's approval before it shows.

export async function POST(req: Request) {
  try {
    const body = await readBody(req, reviewInputSchema);
    const ip = await hit(`review:ip:${clientIp(req.headers) ?? "unknown"}`, 10, 60 * 60);
    const order = await hit(`review:order:${body.token}`, 12, 24 * 60 * 60);
    if (!ip.ok || !order.ok)
      throw new TooManyRequests(
        "Too many tries. Wait a little, then send it again.",
        Math.max(ip.ok ? 0 : ip.retryAfter, order.ok ? 0 : order.retryAfter),
      );
    await submitReview(body);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
