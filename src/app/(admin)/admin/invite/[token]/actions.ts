"use server";

import { z } from "zod";
import { acceptInvitation, MIN_PASSWORD, TeamError } from "@/server/admin/team";
import { hit } from "@/server/rate-limit";
import { clientIp } from "@/server/request";
import { headers } from "next/headers";

const Input = z
  .object({
    token: z.string().min(20).max(200),
    name: z.string().trim().min(2, "Enter your name").max(80),
    password: z.string().min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters`).max(128),
  })
  .strict();

/** Public (the invitee has no account yet): the token itself is the credential */
export async function acceptInvitationAction(
  input: z.input<typeof Input>,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const ip = clientIp(await headers());
  const limit = await hit(`invite-accept:ip:${ip ?? "unknown"}`, 10, 15 * 60);
  if (!limit.ok) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  const parsed = Input.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  try {
    const { email } = await acceptInvitation(parsed.data.token, parsed.data, ip);
    return { ok: true, email };
  } catch (err) {
    if (err instanceof TeamError) return { ok: false, error: err.message };
    console.error("[invite accept]", err);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}
