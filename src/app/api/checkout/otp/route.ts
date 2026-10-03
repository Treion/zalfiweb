import { z } from "zod";
import { phoneSchema } from "@/lib/checkout";
import { clientIp } from "@/server/request";
import { sendCode, verifyCode } from "@/server/checkout/otp";
import { errorResponse, noStore, readBody, setVerifiedCookie } from "@/server/checkout/http";

// Phone verification: { action: "send", phone } texts a 6-digit code; { action: "verify", phone,
// code } checks it and, on success, marks the phone verified in this browser for 24 hours.

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("send"), phone: phoneSchema }).strict(),
  z
    .object({
      action: z.literal("verify"),
      phone: phoneSchema,
      code: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit code."),
    })
    .strict(),
]);

export async function POST(req: Request) {
  try {
    const body = await readBody(req, Body);
    const ip = clientIp(req.headers);
    if (body.action === "send") {
      const sent = await sendCode(body.phone, ip);
      return Response.json({ sent: true, ...sent }, { headers: noStore });
    }
    const { token, expiresAt } = await verifyCode(body.phone, body.code, ip);
    await setVerifiedCookie(token, expiresAt);
    return Response.json({ verified: true, phone: body.phone }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
