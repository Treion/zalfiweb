import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import {
  adminAccounts,
  adminSessions,
  adminTwoFactors,
  adminUsers,
  adminVerifications,
} from "@/db/schema";
import { poolDb } from "@/server/db/pool";
import { hit, resetLimit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { env, siteUrl } from "@/lib/env";

/**
 * Admin authentication (Better Auth, email + password). Customers never have accounts.
 *  - No public sign-up: the first owner comes from `npm run admin:create-owner`, everyone else from
 *    an owner's invitation (src/server/admin/team.ts).
 *  - Sessions end after SESSION_IDLE of inactivity (sliding expiry).
 *  - Deactivated users can't start a session; deactivating also deletes their sessions at once.
 *  - Sign-in is rate-limited per IP and per email (Postgres limiter).
 *  - Optional TOTP two-factor (offered to the owner).
 */
export const SESSION_IDLE_SECONDS = 4 * 60 * 60;
export const AUTH_BASE_PATH = "/api/admin/auth";

const SIGN_IN_LIMIT = { perIp: 20, perEmail: 8, windowSeconds: 15 * 60 };

function secret() {
  const s = env("BETTER_AUTH_SECRET");
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("BETTER_AUTH_SECRET must be set in production");
  return "dev-only-secret-change-me-dev-only-secret-change-me";
}

function create() {
  const baseURL = env("BETTER_AUTH_URL") ?? siteUrl();
  const dev = process.env.NODE_ENV !== "production";
  const db = poolDb();
  return betterAuth({
    appName: "ZALFI Admin",
    baseURL,
    basePath: AUTH_BASE_PATH,
    secret: secret(),
    // In development the admin may be opened as localhost or 127.0.0.1, on any port
    trustedOrigins: dev ? [baseURL, "http://localhost:*", "http://127.0.0.1:*"] : [baseURL],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        adminUsers,
        adminSessions,
        adminAccounts,
        adminVerifications,
        adminTwoFactors,
      },
    }),
    user: {
      modelName: "adminUsers",
      additionalFields: {
        role: { type: "string", required: true, defaultValue: "manager", input: false },
        active: { type: "boolean", required: true, defaultValue: true, input: false },
        lastLoginAt: { type: "date", required: false, input: false },
      },
    },
    session: {
      modelName: "adminSessions",
      expiresIn: SESSION_IDLE_SECONDS,
      // Slide the expiry forward at most every 15 minutes of activity
      updateAge: 15 * 60,
    },
    account: { modelName: "adminAccounts" },
    verification: { modelName: "adminVerifications" },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
    },
    // Our own Postgres limiter (below) guards sign-in; Better Auth's in-memory one is per-instance
    rateLimit: { enabled: false },
    advanced: {
      cookiePrefix: "zalfi-admin",
      useSecureCookies: baseURL.startsWith("https://"),
      database: { generateId: () => crypto.randomUUID() },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const [u] = await db
              .select({ active: adminUsers.active })
              .from(adminUsers)
              .where(eq(adminUsers.id, session.userId));
            if (!u?.active)
              throw new APIError("FORBIDDEN", { message: "This account is deactivated." });
            return { data: session };
          },
          after: async (session) => {
            await db
              .update(adminUsers)
              .set({ lastLoginAt: new Date() })
              .where(eq(adminUsers.id, session.userId));
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const ip = ctx.request ? clientIp(ctx.request.headers) : null;
        const email = String((ctx.body as { email?: unknown })?.email ?? "").toLowerCase();
        const [byIp, byEmail] = await Promise.all([
          hit(
            `admin-login:ip:${ip ?? "unknown"}`,
            SIGN_IN_LIMIT.perIp,
            SIGN_IN_LIMIT.windowSeconds,
          ),
          hit(`admin-login:email:${email}`, SIGN_IN_LIMIT.perEmail, SIGN_IN_LIMIT.windowSeconds),
        ]);
        if (!byIp.ok || !byEmail.ok)
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many attempts. Try again in a few minutes.",
          });
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email" || !ctx.context.newSession) return;
        const email = String((ctx.body as { email?: unknown })?.email ?? "").toLowerCase();
        await resetLimit(`admin-login:email:${email}`);
      }),
    },
    plugins: [
      twoFactor({
        issuer: "ZALFI Admin",
        schema: { twoFactor: { modelName: "adminTwoFactors" } },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof create>;

let cached: Auth | undefined;

/** The auth instance, created on first use (so builds never need a database) */
export function getAuth(): Auth {
  cached ??= create();
  return cached;
}
