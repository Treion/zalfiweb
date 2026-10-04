import { z } from "zod";
import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody } from "@/server/checkout/http";
import { submitManualPayment, WALLETS } from "@/server/payments/manual";

// bKash or Nagad, paid by hand: the customer gives the transaction ID on their order's page. The
// order is found by its private access token; the team checks the money before anything is paid.

const Body = z
  .object({
    o: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/),
    wallet: z.enum(WALLETS),
    sender: z.string().trim().max(20),
    trxId: z.string().trim().max(30),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const body = await readBody(req, Body);
    const r = await hit(`manual-pay:ip:${clientIp(req.headers) ?? "unknown"}`, 10, 10 * 60);
    if (!r.ok) throw new TooManyRequests("Too many attempts. Wait a little.", r.retryAfter);
    const done = await submitManualPayment(body.o, body);
    return Response.json({ ok: true, number: done.number }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
