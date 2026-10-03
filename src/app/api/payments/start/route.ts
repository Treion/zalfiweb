import { eq } from "drizzle-orm";
import { z } from "zod";
import { orders } from "@/db/schema";
import { poolDb } from "@/server/db/pool";
import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody } from "@/server/checkout/http";
import { UserFacingError } from "@/server/errors";
import { startPayment } from "@/server/payments/service";

// "Pay now" on an unpaid order's page: a new payment attempt, and the payment page's URL. The
// order is found by its private access token (only the customer's browser has it).

const Body = z.object({ o: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) }).strict();

export async function POST(req: Request) {
  try {
    const { o } = await readBody(req, Body);
    const r = await hit(`pay-start:ip:${clientIp(req.headers) ?? "unknown"}`, 20, 10 * 60);
    if (!r.ok) throw new TooManyRequests("Too many attempts. Wait a little.", r.retryAfter);
    const [order] = await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.accessToken, o))
      .limit(1);
    if (!order) throw new UserFacingError("We can't find that order.");
    return Response.json({ url: await startPayment(order.id) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
