import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb } from "@/server/db/pool";
import { getSettings } from "@/server/settings";
import { emailProvider } from "@/server/providers/email";
import { loadInvoice } from "@/server/invoice/data";
import { renderReceipt } from "@/server/invoice/email";
import { renderInvoicePdf } from "@/server/invoice/pdf";
import { addEvent } from "./events";

/**
 * Sends the e-receipt (with the PDF invoice attached) to the order's email: automatically when the
 * order is confirmed, or again from the admin. The outcome is written to the order's timeline.
 */
export async function sendReceipt(orderId: number, admin?: Actor) {
  const loaded = await loadInvoice(orderId);
  if (!loaded) return { ok: false as const, error: "Order not found" };
  const { order, data } = loaded;
  const [{ html, text, subject }, pdf, { email }] = await Promise.all([
    renderReceipt(data),
    renderInvoicePdf(data),
    getSettings("integrations"),
  ]);
  const sent = await emailProvider(email).send({
    to: order.customerEmail,
    subject,
    html,
    text,
    tag: `receipt-${order.number}`,
    attachments: [{ filename: `ZALFI-${order.number}.pdf`, content: pdf }],
  });

  const db = poolDb();
  await db.transaction(async (tx) => {
    if (sent.ok)
      await tx.update(orders).set({ receiptSentAt: new Date() }).where(eq(orders.id, orderId));
    await addEvent(tx, orderId, {
      type: "receipt",
      actor: admin ? `admin:${admin.id}` : "system",
      message: sent.ok
        ? `E-receipt ${admin ? "sent again" : "sent"} to ${order.customerEmail}.`
        : `The e-receipt couldn't be sent: ${sent.error}`,
    });
    if (admin)
      await audit(tx, admin, "order.receipt.resend", {
        entity: "order",
        entityId: order.number,
        after: { ok: sent.ok },
      });
  });
  return sent;
}
