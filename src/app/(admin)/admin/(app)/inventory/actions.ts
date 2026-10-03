"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { adjustStockAdmin, setThreshold } from "@/server/catalog/inventory";
import { stockAdjustSchema } from "@/server/catalog/schema";

export async function adjustStockAction(input: unknown) {
  return runAction("inventory.manage", stockAdjustSchema, input, async (d, admin) => {
    const stock = await adjustStockAdmin(d, admin.actor);
    revalidatePath("/admin", "layout");
    return { stock };
  });
}

export async function setThresholdAction(input: unknown) {
  return runAction(
    "inventory.manage",
    z
      .object({
        variantId: z.number().int().positive(),
        threshold: z.number().int().min(0).max(10_000).nullable(),
      })
      .strict(),
    input,
    async (d, admin) => {
      await setThreshold(d.variantId, d.threshold, admin.actor);
      revalidatePath("/admin", "layout");
    },
  );
}
