"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { replyToReview, setReviewStatus } from "@/server/reviews";

const id = z.number().int().positive();

/** Approve (it shows on the shop) or reject (it never does) */
export async function moderateReviewAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, status: z.enum(["approved", "rejected"]) }).strict(),
    input,
    async (d, admin) => {
      await setReviewStatus(d.id, d.status, admin.actor);
      revalidatePath("/admin", "layout");
    },
  );
}

/** The house's reply, shown under the review on the shop. Blank removes it. */
export async function replyReviewAction(input: unknown) {
  return runAction(
    "products.manage",
    z.object({ id, reply: z.string().max(600) }).strict(),
    input,
    async (d, admin) => {
      await replyToReview(d.id, d.reply, admin.actor);
      revalidatePath("/admin/reviews");
    },
  );
}
