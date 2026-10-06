import { z } from "zod";
import { phoneSchema } from "@/lib/checkout";
import { clientIp } from "@/server/request";
import { hit } from "@/server/rate-limit";
import { TooManyRequests } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody } from "@/server/checkout/http";
import { requestRestock } from "@/server/catalog/restock";

// "Notify me": a phone waiting for a sold-out sku, texted once when it's back. Rate-limited per IP
// and per phone, so it can't be used to send messages to someone else.

const Body = z
  .object({
    sku: z
      .string()
      .trim()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,39}$/),
    phone: phoneSchema,
  })
  .strict();

export async function POST(req: Request) {
  try {
    const body = await readBody(req, Body);
    const ip = await hit(`restock:ip:${clientIp(req.headers) ?? "unknown"}`, 10, 60 * 60);
    const phone = await hit(`restock:phone:${body.phone}`, 5, 24 * 60 * 60);
    if (!ip.ok || !phone.ok)
      throw new TooManyRequests(
        "Too many requests. Try again later.",
        Math.max(ip.retryAfter, phone.retryAfter),
      );
    const r = await requestRestock(body.sku, body.phone);
    return Response.json(r, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
