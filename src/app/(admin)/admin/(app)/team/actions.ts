"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  createInvitation,
  INVITE_TTL_HOURS,
  revokeInvitation,
  setActive,
  setRole,
} from "@/server/admin/team";
import { runAction } from "@/server/auth/session";
import { emailProvider } from "@/server/providers/email";
import { getSettings } from "@/server/settings";
import { ROLES } from "@/server/auth/permissions";
import { env } from "@/lib/env";

const role = z.enum(ROLES);

async function siteUrl() {
  const configured = env("NEXT_PUBLIC_SITE_URL");
  if (configured) return configured;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function inviteAction(input: unknown) {
  return runAction(
    "team.manage",
    z.object({ email: z.string().trim().toLowerCase().email().max(254), role }).strict(),
    input,
    async (d, admin) => {
      const inv = await createInvitation(d, admin.actor, await siteUrl());
      const { email } = await getSettings("integrations");
      const sent = await emailProvider(email).send({
        to: inv.email,
        tag: "invitation",
        subject: "You're invited to the ZALFI admin",
        text: `${admin.user.name} invited you to the ZALFI admin as a ${inv.role}.\n\nCreate your account: ${inv.url}\n\nThe link works once, for ${INVITE_TTL_HOURS} hours.`,
        html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#1a1816;max-width:480px;margin:0 auto;padding:32px">
<p style="letter-spacing:.3em;font-size:12px;margin:0 0 24px">ZALFI</p>
<p>${escape(admin.user.name)} invited you to the ZALFI admin as a <strong>${inv.role}</strong>.</p>
<p style="margin:28px 0"><a href="${inv.url}" style="background:#1a1816;color:#f6f3ee;padding:12px 20px;border-radius:6px;text-decoration:none">Create your account</a></p>
<p style="color:#6b655e;font-size:13px">The link works once, for ${INVITE_TTL_HOURS} hours.</p></div>`,
      });
      revalidatePath("/admin/team");
      return { url: inv.url, emailed: sent.ok };
    },
  );
}

export async function revokeInviteAction(input: unknown) {
  return runAction(
    "team.manage",
    z.object({ id: z.number().int().positive() }).strict(),
    input,
    async (d, admin) => {
      await revokeInvitation(d.id, admin.actor);
      revalidatePath("/admin/team");
    },
  );
}

export async function setRoleAction(input: unknown) {
  return runAction(
    "team.manage",
    z.object({ userId: z.string().min(1).max(64), role }).strict(),
    input,
    async (d, admin) => {
      await setRole(d.userId, d.role, admin.actor);
      revalidatePath("/admin/team");
    },
  );
}

export async function setActiveAction(input: unknown) {
  return runAction(
    "team.manage",
    z.object({ userId: z.string().min(1).max(64), active: z.boolean() }).strict(),
    input,
    async (d, admin) => {
      await setActive(d.userId, d.active, admin.actor);
      revalidatePath("/admin/team");
    },
  );
}
