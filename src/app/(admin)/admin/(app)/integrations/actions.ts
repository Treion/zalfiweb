"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { UserFacingError } from "@/server/errors";
import {
  getIntegration,
  INTEGRATIONS,
  recordCheck,
  saveIntegration,
  webhookToken,
} from "@/server/integrations";
import { testIntegration } from "@/server/integrations/tests";
import { hit } from "@/server/rate-limit";
import { getSettings, saveSettings } from "@/server/settings";

const name = z.enum(INTEGRATIONS);
const refresh = () => revalidatePath("/admin", "layout");

/**
 * Saves a provider's keys, sandbox or live, or its switch. Secrets come in, never go back out:
 * the page only ever sees their last four characters.
 */
export async function saveIntegrationAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z
      .object({
        name,
        values: z.record(z.string(), z.string().max(2000).nullable()).optional(),
        mode: z.enum(["sandbox", "live"]).optional(),
        enabled: z.boolean().optional(),
      })
      .strict(),
    input,
    async (d, admin) => {
      const r = await saveIntegration(d.name, d, admin.actor);
      refresh();
      return { enabled: r.enabled, configured: r.configured };
    },
  );
}

/** Keys set in the hosting settings (environment), moved into the admin as they are */
export async function copyFromEnvAction(input: unknown) {
  return runAction("integrations.manage", z.object({ name }).strict(), input, async (d, admin) => {
    const r = await getIntegration(d.name);
    if (r.source !== "env")
      throw new UserFacingError("There's nothing in the environment to copy.");
    await saveIntegration(d.name, {}, admin.actor);
    refresh();
  });
}

/** Tries the saved keys with the provider; the answer is kept and shown on the card */
export async function testIntegrationAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z.object({ name, to: z.string().trim().max(30).optional() }).strict(),
    input,
    async (d, admin) => {
      const limit = await hit(`integration-test:${admin.user.id}`, 30, 600);
      if (!limit.ok)
        throw new UserFacingError("That's a lot of tests. Wait a few minutes and try again.");
      const r = await getIntegration(d.name);
      const result = await testIntegration(r, { to: d.to, ownerEmail: admin.user.email });
      await recordCheck(d.name, { ok: result.ok, message: result.message, source: "test" });
      refresh();
      return result;
    },
  );
}

/** A new webhook token: the old one stops working at once, so paste the new one straight away */
export async function rotateWebhookAction(input: unknown) {
  return runAction("integrations.manage", z.object({ name }).strict(), input, async (d, admin) => {
    const token = await webhookToken(d.name, admin.actor, { rotate: true });
    refresh();
    return token;
  });
}

/** Which online gateway checkout tries first */
export async function setGatewayOrderAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z.object({ first: z.enum(["sslcommerz", "aamarpay"]) }).strict(),
    input,
    async (d, admin) => {
      const current = await getSettings("integrations");
      const gatewayOrder =
        d.first === "sslcommerz"
          ? (["sslcommerz", "aamarpay"] as const)
          : (["aamarpay", "sslcommerz"] as const);
      await saveSettings(
        "integrations",
        { ...current, gatewayOrder: [...gatewayOrder] },
        admin.actor,
      );
      refresh();
    },
  );
}

/** "Other courier": parcels sent another way, tracked by the team */
export async function setManualCourierAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z.object({ enabled: z.boolean() }).strict(),
    input,
    async (d, admin) => {
      const current = await getSettings("shipping");
      await saveSettings("shipping", { ...current, manualCourierEnabled: d.enabled }, admin.actor);
      refresh();
    },
  );
}

const wallet = z
  .object({
    enabled: z.boolean(),
    number: z.string().trim().max(20),
    accountType: z.enum(["personal", "merchant", "agent"]),
  })
  .strict();

/** bKash and Nagad, paid by hand and confirmed by the team */
export async function saveManualPaymentAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z
      .object({
        enabled: z.boolean(),
        holdHours: z.number().int().min(1).max(72),
        bkash: wallet,
        nagad: wallet,
      })
      .strict(),
    input,
    async (d, admin) => {
      for (const [label, w] of [
        ["bKash", d.bkash],
        ["Nagad", d.nagad],
      ] as const)
        if (w.enabled && !w.number) throw new UserFacingError(`Add the ${label} number first.`);
      if (d.enabled && !d.bkash.enabled && !d.nagad.enabled)
        throw new UserFacingError("Switch on bKash or Nagad (or both) first.");
      const current = await getSettings("payments");
      const clean = (w: z.output<typeof wallet>) => ({
        ...w,
        number: w.number.replace(/[\s-]/g, ""),
      });
      try {
        await saveSettings(
          "payments",
          { ...current, manual: { ...d, bkash: clean(d.bkash), nagad: clean(d.nagad) } },
          admin.actor,
        );
      } catch (e) {
        if (e instanceof z.ZodError)
          throw new UserFacingError(e.issues[0]?.message ?? "Check the numbers.");
        throw e;
      }
      refresh();
    },
  );
}
