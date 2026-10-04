import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * The server's signing secret (BETTER_AUTH_SECRET): admin sessions, and the hashes of checkout
 * codes and phone verifications. Required in production; development uses a fixed stand-in.
 */
export function appSecret() {
  const s = env("BETTER_AUTH_SECRET");
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  return "dev-only-secret-change-me-dev-only-secret-change-me";
}

/** Compares two secrets in constant time (a webhook token, a signature) */
export function safeEqual(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
