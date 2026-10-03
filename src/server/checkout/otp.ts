import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { phoneOtps, phoneVerifications } from "@/db/schema";
import { poolDb, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { hit } from "@/server/rate-limit";
import { maskPhone } from "@/server/request";
import { appSecret } from "@/server/secret";
import { getSettings } from "@/server/settings";
import { smsProvider } from "@/server/providers/sms";

/**
 * Phone verification at checkout. A 6-digit code by SMS: it expires in 5 minutes, allows 5 tries,
 * and a new one can be sent after 60 seconds. Sends and checks are rate-limited per phone and per
 * IP. Only an HMAC of each code is stored. A verified phone stays verified in that browser for 24
 * hours (an httpOnly cookie holding a random token; the table holds its hash).
 */
export const OTP = {
  length: 6,
  ttlSeconds: 5 * 60,
  maxAttempts: 5,
  resendSeconds: 60,
  verifiedHours: 24,
  /** Sends: per phone per hour, per IP per hour */
  sendPerPhone: 5,
  sendPerIp: 20,
  /** Checks: per IP per 15 minutes (each code also has its own 5 tries) */
  verifyPerIp: 30,
} as const;

export const VERIFIED_COOKIE = "zalfi_phone";

/* ---------------------------------------------------------------------------------------------- */
/* Pure helpers (unit-tested)                                                                      */

export const hashCode = (phone: string, code: string, secret = appSecret()) =>
  createHmac("sha256", secret).update(`otp:${phone}:${code}`).digest("hex");

export const hashToken = (token: string, secret = appSecret()) =>
  createHmac("sha256", secret).update(`phone-token:${token}`).digest("hex");

export function codeMatches(storedHash: string, phone: string, code: string, secret?: string) {
  if (!/^\d{6}$/.test(code)) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashCode(phone, code, secret), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(OTP.length, "0");

/** Seconds until another code may be sent, given when the last one was (0: now) */
export const resendWait = (lastSentAt: Date | null, now: Date) =>
  lastSentAt
    ? Math.max(0, Math.ceil(OTP.resendSeconds - (now.getTime() - lastSentAt.getTime()) / 1000))
    : 0;

export type CodeState = "ok" | "expired" | "locked" | "used";
export function codeState(
  row: { expiresAt: Date; attempts: number; verifiedAt: Date | null },
  now: Date,
): CodeState {
  if (row.verifiedAt) return "used";
  if (row.attempts >= OTP.maxAttempts) return "locked";
  if (row.expiresAt <= now) return "expired";
  return "ok";
}

/* ---------------------------------------------------------------------------------------------- */
/* Sending and checking                                                                            */

export class TooManyRequests extends UserFacingError {
  constructor(
    message: string,
    readonly retryAfter: number,
  ) {
    super(message);
  }
}

/**
 * Sends a code to `phone` (already normalised). Returns the code itself only when the dev SMS
 * provider is in use outside production, so the checkout can show it while developing.
 */
export async function sendCode(phone: string, ip: string | null, exec: Executor = poolDb()) {
  const now = new Date();
  const [last] = await exec
    .select({ createdAt: phoneOtps.createdAt })
    .from(phoneOtps)
    .where(eq(phoneOtps.phone, phone))
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);
  const wait = resendWait(last?.createdAt ?? null, now);
  if (wait > 0) throw new TooManyRequests(`You can ask for a new code in ${wait} seconds.`, wait);

  const perPhone = await hit(`otp-send:phone:${phone}`, OTP.sendPerPhone, 3600, exec);
  if (!perPhone.ok)
    throw new TooManyRequests(
      "Too many codes for this number. Try again later.",
      perPhone.retryAfter,
    );
  if (ip) {
    const perIp = await hit(`otp-send:ip:${ip}`, OTP.sendPerIp, 3600, exec);
    if (!perIp.ok)
      throw new TooManyRequests("Too many codes from here. Try again later.", perIp.retryAfter);
  }

  const code = newCode();
  // A new code replaces any earlier one still open
  await exec
    .update(phoneOtps)
    .set({ expiresAt: now })
    .where(
      and(eq(phoneOtps.phone, phone), isNull(phoneOtps.verifiedAt), gt(phoneOtps.expiresAt, now)),
    );
  await exec.insert(phoneOtps).values({
    phone,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(now.getTime() + OTP.ttlSeconds * 1000),
    ip,
  });

  const { sms } = await getSettings("integrations", exec);
  const provider = smsProvider(sms);
  const sent = await provider.send(
    phone,
    `Your ZALFI code is ${code}. It expires in 5 minutes. Never share it.`,
  );
  if (!sent.ok) {
    console.error(`[otp] send failed to=${maskPhone(phone)}: ${sent.error}`);
    throw new UserFacingError("We couldn't send the code. Check the number and try again.");
  }
  const devCode = provider.name === "dev" && process.env.NODE_ENV !== "production" ? code : null;
  return { resendIn: OTP.resendSeconds, expiresIn: OTP.ttlSeconds, devCode };
}

/**
 * Checks a code. On success, returns a token for the browser's cookie: the phone then stays
 * verified there for 24 hours.
 */
export async function verifyCode(
  phone: string,
  code: string,
  ip: string | null,
  exec: Executor = poolDb(),
) {
  if (ip) {
    const r = await hit(`otp-verify:ip:${ip}`, OTP.verifyPerIp, 15 * 60, exec);
    if (!r.ok)
      throw new TooManyRequests("Too many tries. Wait a little and try again.", r.retryAfter);
  }
  const now = new Date();
  const [row] = await exec
    .select()
    .from(phoneOtps)
    .where(eq(phoneOtps.phone, phone))
    .orderBy(desc(phoneOtps.createdAt))
    .limit(1);
  if (!row) throw new UserFacingError("Ask for a code first.");
  const state = codeState(row, now);
  if (state === "locked") throw new UserFacingError("Too many tries. Ask for a new code.");
  if (state !== "ok") throw new UserFacingError("That code has expired. Ask for a new one.");

  // Count the try first, atomically, so parallel guesses can't exceed the limit
  const [counted] = await exec
    .update(phoneOtps)
    .set({ attempts: sql`${phoneOtps.attempts} + 1` })
    .where(and(eq(phoneOtps.id, row.id), lt(phoneOtps.attempts, OTP.maxAttempts)))
    .returning({ attempts: phoneOtps.attempts });
  if (!counted) throw new UserFacingError("Too many tries. Ask for a new code.");

  if (!codeMatches(row.codeHash, phone, code.trim())) {
    const left = OTP.maxAttempts - counted.attempts;
    throw new UserFacingError(
      left > 0
        ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.`
        : "That code isn't right. Ask for a new one.",
    );
  }
  await exec.update(phoneOtps).set({ verifiedAt: now }).where(eq(phoneOtps.id, row.id));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + OTP.verifiedHours * 3600 * 1000);
  await exec.insert(phoneVerifications).values({ phone, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** The phone this browser verified (from its cookie token), or null */
export async function verifiedPhone(token: string | undefined, exec: Executor = poolDb()) {
  if (!token || token.length > 100) return null;
  const [row] = await exec
    .select({ phone: phoneVerifications.phone })
    .from(phoneVerifications)
    .where(
      and(
        eq(phoneVerifications.tokenHash, hashToken(token)),
        gt(phoneVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.phone ?? null;
}
