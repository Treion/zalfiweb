import { and, asc, count, desc, eq, min, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { discoverySets, fragrances, orderItems, orders, reviews } from "@/db/schema";
import type { reviewInputSchema } from "@/lib/reviews";
import { sizeLabel } from "@/lib/size";
import { audit, type Actor } from "@/server/audit";
import { revalidateStorefront } from "@/server/catalog/products";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";

/**
 * Reviews from verified buyers. A delivered order's own page (opened by its access token) offers
 * one review per line; it waits as "pending" until the team approves or rejects it in Admin →
 * Reviews, where the house can also reply. Only approved reviews reach the shop.
 */
export type ReviewStatus = (typeof reviews.$inferSelect)["status"];

/** The order's lines, each with its review if one was written (the order page shows them) */
export async function orderReviews(orderId: number, exec: Executor = poolDb()) {
  const rows = await exec
    .select({
      itemId: orderItems.id,
      name: orderItems.name,
      sizeMl: orderItems.sizeMl,
      pieces: orderItems.pieces,
      fragranceId: orderItems.fragranceId,
      setId: orderItems.setId,
      status: reviews.status,
      rating: reviews.rating,
    })
    .from(orderItems)
    .leftJoin(reviews, eq(reviews.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));
  return rows
    .filter((r) => r.fragranceId || r.setId)
    .map((r) => ({
      itemId: r.itemId,
      name: r.name,
      size: sizeLabel(r.sizeMl, r.pieces),
      review: r.status ? { status: r.status, rating: r.rating! } : null,
    }));
}
export type OrderReviewLine = Awaited<ReturnType<typeof orderReviews>>[number];

/** A buyer's review of one line of their delivered order. It waits for the team's approval. */
export async function submitReview(input: z.output<typeof reviewInputSchema>) {
  return withTx(async (tx) => {
    const [o] = await tx
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(eq(orders.accessToken, input.token))
      .for("share");
    if (!o) throw new UserFacingError("We couldn't find that order.");
    if (o.status !== "delivered")
      throw new UserFacingError("You can review your order once it's delivered.");
    const [line] = await tx
      .select({ id: orderItems.id, fragranceId: orderItems.fragranceId, setId: orderItems.setId })
      .from(orderItems)
      .where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, o.id)));
    if (!line || (!line.fragranceId && !line.setId))
      throw new UserFacingError("That isn't part of this order.");
    const [row] = await tx
      .insert(reviews)
      .values({
        orderId: o.id,
        orderItemId: line.id,
        fragranceId: line.fragranceId,
        setId: line.setId,
        rating: input.rating,
        body: input.body,
        displayName: input.name,
      })
      .onConflictDoNothing({ target: reviews.orderItemId })
      .returning({ id: reviews.id });
    if (!row) throw new UserFacingError("You've already reviewed this one. Thank you.");
    return { id: row.id };
  });
}

/* ------------------------------------------------------------------------------------------- */
/* Admin                                                                                         */

export const REVIEW_FILTERS = ["pending", "approved", "rejected", "all"] as const;
export type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export async function listReviewsAdmin(filter: ReviewFilter, exec: Executor = poolDb()) {
  const where: SQL | undefined = filter === "all" ? undefined : eq(reviews.status, filter);
  return exec
    .select({
      id: reviews.id,
      rating: reviews.rating,
      body: reviews.body,
      name: reviews.displayName,
      status: reviews.status,
      reply: reviews.reply,
      createdAt: reviews.createdAt,
      moderatedAt: reviews.moderatedAt,
      orderId: orders.id,
      orderNumber: orders.number,
      customerName: orders.customerName,
      fragrance: fragrances.name,
      fragranceSlug: fragrances.slug,
      set: discoverySets.name,
    })
    .from(reviews)
    .innerJoin(orders, eq(orders.id, reviews.orderId))
    .leftJoin(fragrances, eq(fragrances.id, reviews.fragranceId))
    .leftJoin(discoverySets, eq(discoverySets.id, reviews.setId))
    .where(where)
    .orderBy(filter === "pending" ? asc(reviews.createdAt) : desc(reviews.createdAt))
    .limit(200);
}
export type AdminReview = Awaited<ReturnType<typeof listReviewsAdmin>>[number];

/** How many reviews wait to be read, and since when (Overview → Needs attention, the nav) */
export async function pendingReviews(exec: Executor = poolDb()) {
  const [r] = await exec
    .select({ n: count(), oldest: min(reviews.createdAt) })
    .from(reviews)
    .where(eq(reviews.status, "pending"));
  return { count: Number(r?.n ?? 0), oldest: r?.oldest ?? null };
}

export async function reviewCounts(exec: Executor = poolDb()) {
  const rows = await exec
    .select({ status: reviews.status, n: count() })
    .from(reviews)
    .groupBy(reviews.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return {
    pending: by.pending ?? 0,
    approved: by.approved ?? 0,
    rejected: by.rejected ?? 0,
  };
}

/** Approve (it shows on the shop) or reject (it never does). Either can be changed later. */
export async function setReviewStatus(
  id: number,
  status: Exclude<ReviewStatus, "pending">,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(reviews).where(eq(reviews.id, id)).for("update");
    if (!before) throw new UserFacingError("That review no longer exists.");
    if (before.status === status) return;
    await tx
      .update(reviews)
      .set({ status, moderatedBy: actor.id, moderatedAt: new Date() })
      .where(eq(reviews.id, id));
    await audit(tx, actor, `review.${status === "approved" ? "approve" : "reject"}`, {
      entity: "review",
      entityId: id,
      before: { status: before.status },
      after: { status },
    });
  });
  await revalidateStorefront();
}

/** The house's reply, shown under the review once it's approved. Blank removes it. */
export async function replyToReview(id: number, reply: string, actor: Actor) {
  const text = reply.trim() || null;
  await withTx(async (tx) => {
    const [before] = await tx.select().from(reviews).where(eq(reviews.id, id)).for("update");
    if (!before) throw new UserFacingError("That review no longer exists.");
    await tx
      .update(reviews)
      .set({ reply: text, repliedAt: text ? new Date() : null })
      .where(eq(reviews.id, id));
    await audit(tx, actor, "review.reply", {
      entity: "review",
      entityId: id,
      before: { reply: before.reply },
      after: { reply: text },
    });
  });
  await revalidateStorefront();
}
