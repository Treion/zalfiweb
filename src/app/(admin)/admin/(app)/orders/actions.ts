"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction } from "@/server/auth/session";
import { addNote, moveOrders } from "@/server/orders/manage";
import { sendReceipt } from "@/server/orders/receipt";
import { ORDER_STATUSES } from "@/server/orders/state";
import { UserFacingError } from "@/server/errors";

const id = z.number().int().positive();

export async function moveOrdersAction(input: unknown) {
  return runAction(
    "orders.manage",
    z
      .object({
        ids: z.array(id).min(1).max(200),
        to: z.enum(ORDER_STATUSES),
        note: z.string().trim().max(500).optional(),
        restock: z.boolean().optional(),
      })
      .strict(),
    input,
    async (d, admin) => {
      const r = await moveOrders(d.ids, d.to, admin.actor, { note: d.note, restock: d.restock });
      revalidatePath("/admin", "layout");
      return r;
    },
  );
}

export async function addNoteAction(input: unknown) {
  return runAction(
    "orders.manage",
    z.object({ id, text: z.string().trim().min(1).max(2000) }).strict(),
    input,
    async (d, admin) => {
      await addNote(d.id, d.text, admin.actor);
      revalidatePath(`/admin/orders/${d.id}`);
    },
  );
}

export async function resendReceiptAction(input: unknown) {
  return runAction("orders.manage", z.object({ id }).strict(), input, async (d, admin) => {
    const r = await sendReceipt(d.id, admin.actor);
    revalidatePath(`/admin/orders/${d.id}`);
    if (!r.ok) throw new UserFacingError(`The e-receipt couldn't be sent: ${r.error}`);
  });
}
