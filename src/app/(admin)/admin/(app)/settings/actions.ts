"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserFacingError } from "@/server/errors";
import { runAction } from "@/server/auth/session";
import { revalidateStorefront } from "@/server/catalog/products";
import { saveSettings, SETTINGS_KEYS } from "@/server/settings";

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
      // Permissions and fees are read across the admin; fees, delivery times and payment methods
      // are also shown on the shop
      revalidatePath("/admin", "layout");
      if (d.key === "shipping" || d.key === "payments" || d.key === "store")
        await revalidateStorefront();
    },
  );
}
