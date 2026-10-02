import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const adminRole = pgEnum("admin_role", ["owner", "manager"]);

/* ---------------------------------------------------------------------------------------------- */
/* Better Auth (admin only). Property names are the library's field names; columns are snake_case. */

export const adminUsers = pgTable("admin_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: adminRole("role").notNull().default("manager"),
  /** Deactivated users can't sign in, and their sessions are revoked at once */
  active: boolean("active").notNull().default(true),
  lastLoginAt: ts("last_login_at"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

export const adminAccounts = pgTable(
  "admin_accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("admin_accounts_user_idx").on(t.userId)],
);

export const adminVerifications = pgTable(
  "admin_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expires_at").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("admin_verifications_identifier_idx").on(t.identifier)],
);

/** Optional TOTP for the owner (Better Auth two-factor plugin) */
export const adminTwoFactors = pgTable(
  "admin_two_factors",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: ts("locked_until"),
  },
  (t) => [
    index("admin_two_factors_user_idx").on(t.userId),
    index("admin_two_factors_secret_idx").on(t.secret),
  ],
);

/* ---------------------------------------------------------------------------------------------- */

/** The owner invites managers by email. The link carries a token; only its hash is stored. */
export const adminInvitations = pgTable(
  "admin_invitations",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    role: adminRole("role").notNull().default("manager"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: ts("expires_at").notNull(),
    invitedBy: text("invited_by").references(() => adminUsers.id, { onDelete: "set null" }),
    acceptedAt: ts("accepted_at"),
    revokedAt: ts("revoked_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_invitations_token_idx").on(t.tokenHash),
    index("admin_invitations_email_idx").on(t.email),
  ],
);

/** Typed settings: one row per section, validated by src/server/settings/schema.ts */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => adminUsers.id, { onDelete: "set null" }),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/** Who did what, when: every important admin action, with before/after values */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_entity_idx").on(t.entity, t.entityId),
  ],
);

/** Fixed-window rate limiter (src/server/rate-limit.ts): one row per key */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: ts("window_start").notNull(),
  count: integer("count").notNull(),
});
