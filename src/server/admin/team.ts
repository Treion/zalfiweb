import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { adminInvitations, adminUsers } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { getAuth } from "@/server/auth/auth";
import type { Role } from "@/server/auth/permissions";
import { poolDb, withTx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";

/**
 * The admin team: creating users (owner CLI, accepted invitations), invitations, role changes and
 * deactivation. Plain functions, so the CLI scripts and the server actions share them.
 */

export const INVITE_TTL_HOURS = 48;
export const MIN_PASSWORD = 10;

/** A message that is safe to show (the server actions turn it into a toast) */
export class TeamError extends UserFacingError {}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const normEmail = (e: string) => e.trim().toLowerCase();

/** Creates an admin user with an email + password login. */
export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
}) {
  const email = normEmail(input.email);
  if (input.password.length < MIN_PASSWORD)
    throw new TeamError(`Passwords need at least ${MIN_PASSWORD} characters.`);
  const ctx = await getAuth().$context;
  if (await ctx.internalAdapter.findUserByEmail(email))
    throw new TeamError("There is already a team member with this email.");
  const hash = await ctx.password.hash(input.password);
  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name.trim(), emailVerified: true, role: input.role, active: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return user;
}

export async function listTeam() {
  return poolDb()
    .select({
      id: adminUsers.id,
      name: adminUsers.name,
      email: adminUsers.email,
      role: adminUsers.role,
      active: adminUsers.active,
      lastLoginAt: adminUsers.lastLoginAt,
      twoFactorEnabled: adminUsers.twoFactorEnabled,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt);
}

export async function listOpenInvitations() {
  return poolDb()
    .select({
      id: adminInvitations.id,
      email: adminInvitations.email,
      role: adminInvitations.role,
      expiresAt: adminInvitations.expiresAt,
      createdAt: adminInvitations.createdAt,
    })
    .from(adminInvitations)
    .where(
      and(
        isNull(adminInvitations.acceptedAt),
        isNull(adminInvitations.revokedAt),
        gt(adminInvitations.expiresAt, new Date()),
      ),
    )
    .orderBy(adminInvitations.createdAt);
}

/**
 * Invites someone by email. Returns the one-time link (only its hash is stored). Inviting the same
 * email again revokes the earlier, unused link.
 */
export async function createInvitation(
  input: { email: string; role: Role },
  actor: Actor,
  siteUrl: string,
) {
  const email = normEmail(input.email);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3600_000);
  await withTx(async (tx) => {
    const [existing] = await tx
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.email, email));
    if (existing) throw new TeamError("This person is already on the team.");
    await tx
      .update(adminInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(adminInvitations.email, email), isNull(adminInvitations.acceptedAt)));
    const [inv] = await tx
      .insert(adminInvitations)
      .values({ email, role: input.role, tokenHash: sha256(token), expiresAt, invitedBy: actor.id })
      .returning({ id: adminInvitations.id });
    await audit(tx, actor, "team.invite", {
      entity: "invitation",
      entityId: inv.id,
      after: { email, role: input.role, expiresAt },
    });
  });
  return {
    email,
    role: input.role,
    expiresAt,
    url: `${siteUrl.replace(/\/$/, "")}/admin/invite/${token}`,
  };
}

export async function revokeInvitation(id: number, actor: Actor) {
  await withTx(async (tx) => {
    const [inv] = await tx
      .update(adminInvitations)
      .set({ revokedAt: new Date() })
      .where(and(eq(adminInvitations.id, id), isNull(adminInvitations.acceptedAt)))
      .returning({ email: adminInvitations.email });
    if (!inv) throw new TeamError("That invitation has already been used or withdrawn.");
    await audit(tx, actor, "team.invite.revoke", {
      entity: "invitation",
      entityId: id,
      before: inv,
    });
  });
}

/** The invitation behind a link, if it can still be used */
export async function findInvitation(token: string) {
  const [inv] = await poolDb()
    .select()
    .from(adminInvitations)
    .where(eq(adminInvitations.tokenHash, sha256(token)));
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt <= new Date()) return null;
  return inv;
}

/** Accepts an invitation: creates the account with the invited role, and uses up the link. */
export async function acceptInvitation(
  token: string,
  input: { name: string; password: string },
  ip: string | null = null,
) {
  const inv = await findInvitation(token);
  if (!inv) throw new TeamError("This invitation link has expired or was already used.");
  // Claim the link first, so two tabs can't both use it
  const [claimed] = await poolDb()
    .update(adminInvitations)
    .set({ acceptedAt: new Date() })
    .where(and(eq(adminInvitations.id, inv.id), isNull(adminInvitations.acceptedAt)))
    .returning({ id: adminInvitations.id });
  if (!claimed) throw new TeamError("This invitation link was already used.");
  try {
    const user = await createAdminUser({
      email: inv.email,
      name: input.name,
      password: input.password,
      role: inv.role,
    });
    await audit(poolDb(), { id: user.id, email: user.email, ip }, "team.invite.accept", {
      entity: "user",
      entityId: user.id,
      after: { email: user.email, role: inv.role },
    });
    return { email: inv.email };
  } catch (err) {
    // Give the link back if the account couldn't be created (a too-short password, say)
    await poolDb()
      .update(adminInvitations)
      .set({ acceptedAt: null })
      .where(eq(adminInvitations.id, inv.id));
    throw err;
  }
}

async function activeOwners() {
  const [r] = await poolDb()
    .select({ n: count() })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true)));
  return r?.n ?? 0;
}

export async function setRole(userId: string, role: Role, actor: Actor) {
  if (userId === actor.id) throw new TeamError("You can't change your own role.");
  const [before] = await poolDb().select().from(adminUsers).where(eq(adminUsers.id, userId));
  if (!before) throw new TeamError("That team member no longer exists.");
  if (before.role === "owner" && role !== "owner" && before.active && (await activeOwners()) <= 1)
    throw new TeamError("The store needs at least one active owner.");
  await withTx(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ role, updatedAt: new Date() })
      .where(eq(adminUsers.id, userId));
    await audit(tx, actor, "team.role", {
      entity: "user",
      entityId: userId,
      before: { role: before.role },
      after: { role },
    });
  });
}

/** Deactivating takes effect at once: the user's sessions are deleted with it. */
export async function setActive(userId: string, active: boolean, actor: Actor) {
  if (userId === actor.id) throw new TeamError("You can't deactivate yourself.");
  const [before] = await poolDb().select().from(adminUsers).where(eq(adminUsers.id, userId));
  if (!before) throw new TeamError("That team member no longer exists.");
  if (!active && before.role === "owner" && before.active && (await activeOwners()) <= 1)
    throw new TeamError("The store needs at least one active owner.");
  await withTx(async (tx) => {
    await tx
      .update(adminUsers)
      .set({ active, updatedAt: new Date() })
      .where(eq(adminUsers.id, userId));
    await audit(tx, actor, active ? "team.reactivate" : "team.deactivate", {
      entity: "user",
      entityId: userId,
      before: { active: before.active },
      after: { active },
    });
  });
  if (!active) await (await getAuth().$context).internalAdapter.deleteUserSessions(userId);
}
