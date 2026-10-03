"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserFacingError } from "@/server/errors";
import { runAction } from "@/server/auth/session";
import { getSettings, saveSettings, SETTINGS_KEYS } from "@/server/settings";
import { resolveGateway } from "@/server/payments/providers";

const EDITABLE = SETTINGS_KEYS.filter((k) => k !== "integrations") as [string, ...string[]];

export async function saveSettingsAction(input: unknown) {
  return runAction(
    "settings.manage",
    z.object({ key: z.enum(EDITABLE), value: z.unknown() }).strict(),
    input,
    async (d, admin) => {
      try {
        await saveSettings(d.key as (typeof SETTINGS_KEYS)[number], d.value, admin.actor);
      } catch (err) {
        if (err instanceof z.ZodError) {
          const i = err.issues[0];
          throw new UserFacingError(i ? `${i.path.join(".")}: ${i.message}` : "Check the form.");
        }
        throw err;
      }
      // Permissions and fees are read across the admin and (later) the checkout
      revalidatePath("/admin", "layout");
    },
  );
}

/** Which gateway takes online payments (owner only; the keys themselves live in the environment) */
export async function setPaymentGatewayAction(input: unknown) {
  return runAction(
    "integrations.manage",
    z.object({ payments: z.enum(["mock", "sslcommerz"]) }).strict(),
    input,
    async (d, admin) => {
      const current = await getSettings("integrations");
      await saveSettings("integrations", { ...current, payments: d.payments }, admin.actor);
      revalidatePath("/admin", "layout");
      return resolveGateway(d.payments).note;
    },
  );
}
