"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { deleteCoupon, saveCoupon, setCouponActive } from "@/server/coupons";
import { couponSchema } from "@/server/coupons/schema";

const id = z.number().int().positive();

export async function saveCouponAction(input: unknown) {
  return runAction(
    "coupons.manage",
    z.object({ id: id.nullable(), values: couponSchema }).strict(),
    input,
    async (d, admin) => {
      const row = await saveCoupon(d.id, d.values, admin.actor);
      revalidatePath("/admin/coupons", "layout");
      return { id: row.id };
    },
  );
}

export async function setCouponActiveAction(input: unknown) {
  return runAction(
    "coupons.manage",
    z.object({ id, active: z.boolean() }).strict(),
    input,
    async (d, admin) => {
      await setCouponActive(d.id, d.active, admin.actor);
      revalidatePath("/admin/coupons", "layout");
    },
  );
}

export async function deleteCouponAction(input: unknown) {
  return runAction("coupons.manage", z.object({ id }).strict(), input, async (d, admin) => {
    await deleteCoupon(d.id, admin.actor);
    revalidatePath("/admin/coupons", "layout");
  });
}
