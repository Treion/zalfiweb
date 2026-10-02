import "server-only";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import type { z } from "zod";
import type { Actor } from "@/server/audit";
import { getSettings } from "@/server/settings";
import { UserFacingError } from "@/server/errors";
import { clientIp } from "@/server/request";
import { getAuth } from "./auth";
import { can, isRole, type Permission, type PermissionToggles, type Role } from "./permissions";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
};

export type AdminContext = {
  user: AdminUser;
  toggles: PermissionToggles;
  actor: Actor;
  can: (permission: Permission) => boolean;
};

/** The signed-in admin for this request, or null. Deactivated users count as signed out. */
export const getAdmin = cache(async (): Promise<AdminContext | null> => {
  const h = await headers();
  const s = await getAuth()
    .api.getSession({ headers: h })
    .catch(() => null);
  if (!s) return null;
  const u = s.user as typeof s.user & {
    role?: string;
    active?: boolean;
    twoFactorEnabled?: boolean | null;
  };
  if (!u.active || !isRole(u.role)) return null;
  const toggles = await getSettings("permissions");
  const user: AdminUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    twoFactorEnabled: !!u.twoFactorEnabled,
  };
  return {
    user,
    toggles,
    actor: { id: u.id, email: u.email, ip: clientIp(h) },
    can: (p) => can(user.role, p, toggles),
  };
});

/** For pages and layouts: signed out → login; signed in without the permission → 403 */
export async function requireAdmin(permission?: Permission): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (permission && !admin.can(permission)) forbidden();
  return admin;
}

/* ---------------------------------------------------------------------------------------------- */
/* Server actions                                                                                  */

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** An error whose message is safe to show the admin */
export { UserFacingError as ActionError } from "@/server/errors";

/**
 * The one way admin mutations run: validate the input strictly (unknown fields rejected), check the
 * session and permission again on the server, then do the work. Errors come back as a message for
 * a toast; unexpected ones are logged and shown generically.
 */
export async function runAction<S extends z.ZodType, T>(
  permission: Permission,
  schema: S,
  input: unknown,
  fn: (data: z.output<S>, admin: AdminContext) => Promise<T>,
): Promise<ActionResult<T>> {
  const admin = await getAdmin();
  if (!admin) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!admin.can(permission)) return { ok: false, error: "You don't have access to this." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue ? `${issue.path.join(".") || "Input"}: ${issue.message}` : "Invalid input.",
    };
  }
  try {
    return { ok: true, data: await fn(parsed.data, admin) };
  } catch (err) {
    if (err instanceof UserFacingError) return { ok: false, error: err.message };
    console.error(`[admin action] ${permission}`, err);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}
