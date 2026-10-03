import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Vercel Cron calls carry `Authorization: Bearer $CRON_SECRET`. Without a secret configured, cron
 * routes only answer in development.
 */
export function authorisedCron(req: Request) {
  const secret = env("CRON_SECRET");
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
