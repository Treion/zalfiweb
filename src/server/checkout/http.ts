import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { UserFacingError } from "@/server/errors";
import { TooManyRequests, VERIFIED_COOKIE, verifiedPhone } from "./otp";

/**
 * Shared plumbing for the checkout's route handlers. They run on Node (the transactional Pool,
 * node:crypto and the PDF renderer), not the Edge. Every body is validated by a strict Zod schema;
 * errors written for customers are returned as `{ error }`, anything else as a generic message.
 */
export const noStore = { "Cache-Control": "no-store" };

export async function readBody<S extends z.ZodType>(req: Request, schema: S) {
  const raw = await req.json().catch(() => null);
  const r = schema.safeParse(raw);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new UserFacingError(
      first && first.code === "custom" ? first.message : (first?.message ?? "Check your details."),
    );
  }
  return r.data as z.output<S>;
}

export function errorResponse(e: unknown) {
  if (e instanceof TooManyRequests)
    return Response.json(
      { error: e.message, retryAfter: e.retryAfter },
      { status: 429, headers: { ...noStore, "Retry-After": String(e.retryAfter) } },
    );
  if (e instanceof UserFacingError)
    return Response.json({ error: e.message }, { status: 400, headers: noStore });
  console.error("[checkout]", e);
  return Response.json(
    { error: "Something went wrong on our side. Try again in a moment." },
    { status: 500, headers: noStore },
  );
}

/** Checkout needs the database; without one (a storefront-only preview) it is closed */
export const checkoutOpen = () => !!env("DATABASE_URL");

export async function phoneFromCookie() {
  return verifiedPhone((await cookies()).get(VERIFIED_COOKIE)?.value);
}

export async function setVerifiedCookie(token: string, expires: Date) {
  (await cookies()).set(VERIFIED_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}
