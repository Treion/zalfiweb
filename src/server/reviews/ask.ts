import { and, asc, eq, isNull } from "drizzle-orm";
import { orderItems, orders } from "@/db/schema";
import { siteUrl } from "@/lib/env";
import { listNames } from "@/lib/words";
import { poolDb } from "@/server/db/pool";
import { addEvent } from "@/server/orders/events";
import { confirmationUrl } from "@/server/payments/service";
import { emailProvider } from "@/server/providers/email";
import { getSettings } from "@/server/settings";
import { renderReviewAsk } from "./email";

/**
 * After delivery, once per order: an email with the link to review it (Settings → Reviews can
 * switch it off). Called in the background by the move to delivered; it first waits for that
 * transaction to commit (a locking read), so it sees the order as it ends up.
 */
export async function askForReview(orderId: number) {
  const db = poolDb();
  await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for("share");
  const { askAfterDelivery } = await getSettings("reviews");
  if (!askAfterDelivery) return false;
  // Claim the ask first, so two deliveries reported at once send one email
  const [o] = await db
    .update(orders)
    .set({ reviewAskedAt: new Date() })
    .where(
      and(eq(orders.id, orderId), eq(orders.status, "delivered"), isNull(orders.reviewAskedAt)),
    )
    .returning();
  if (!o) return false;
  const [items, store, provider] = await Promise.all([
    db
      .select({ name: orderItems.name })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.id)),
    getSettings("store"),
    emailProvider(),
  ]);
  const { html, text, subject } = await renderReviewAsk({
    number: o.number,
    firstName: o.customerName.trim().split(/\s+/)[0] ?? o.customerName,
    items: listNames([...new Set(items.map((i) => i.name))]),
    reviewUrl: `${siteUrl()}${confirmationUrl(o.accessToken)}#review`,
    siteUrl: siteUrl(),
    store: { phone: store.contactPhone, email: store.email },
  });
  const sent = await provider.send({
    to: o.customerEmail,
    subject,
    html,
    text,
    tag: `review-ask-${o.number}`,
  });
  await addEvent(db, orderId, {
    type: "review_ask",
    actor: "system",
    message: sent.ok
      ? `Asked ${o.customerEmail} for a review.`
      : `The review email couldn't be sent: ${sent.error}`,
  });
  return sent.ok;
}
