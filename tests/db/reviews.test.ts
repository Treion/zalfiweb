import { readdir } from "node:fs/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  adminUsers,
  customers,
  fragrances,
  orderItems,
  orders,
  reviews,
  settings,
  variants,
} from "@/db/schema";
import { placeOrderSchema } from "@/lib/checkout";
import { reviewInputSchema } from "@/lib/reviews";
import { adjustStock } from "@/server/catalog/stock";
import { quoteBag } from "@/server/checkout/quote";
import { poolDb, withTx } from "@/server/db/pool";
import { transitionOrder } from "@/server/orders/manage";
import { placeOrder } from "@/server/orders/place";
import { OUTBOX_DIR } from "@/server/providers/email";
import { attention } from "@/server/reports/metrics";
import {
  listReviewsAdmin,
  orderReviews,
  pendingReviews,
  replyToReview,
  setReviewStatus,
  submitReview,
} from "@/server/reviews";
import { getReviews } from "@/server/reviews/public";
import { isolateIntegrations } from "./isolate";

vi.mock("server-only", () => ({}));

/**
 * Reviews against a real database: a throwaway fragrance, one cash-on-delivery order taken to
 * delivered, the "how does it wear?" email, a review from the order's page, and the team's
 * approval and reply reaching the shop.
 */
const RUN = Date.now().toString(36);
const SLUG = `zz-rev-${RUN}`;
const SKU = `ZZ-REV-${RUN.toUpperCase()}`;
const phone = `0195${String(Date.now() % 10_000_000).padStart(7, "0")}`;
const admin = { id: `zz-admin-${RUN}`, email: `zz-admin-${RUN}@zalfi.test` };
const integrationsTable = isolateIntegrations();
const saved = new Map<string, unknown>();
let fragranceId = 0;
let orderId = 0;
let itemId = 0;
let token = "";
let number = "";

const review = (o: Partial<Parameters<typeof reviewInputSchema.parse>[0]> = {}) =>
  reviewInputSchema.parse({
    token,
    itemId,
    rating: 5,
    body: "Lasts all day.",
    name: "Nusrat J.",
    ...o,
  });

async function setSetting(key: string, value: unknown) {
  if (!saved.has(key)) {
    const [row] = await poolDb().select().from(settings).where(eq(settings.key, key));
    saved.set(key, row?.value);
  }
  await poolDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

beforeAll(async () => {
  await integrationsTable.save();
  await poolDb().insert(adminUsers).values({ id: admin.id, name: "Test", email: admin.email });
  const [f] = await poolDb()
    .insert(fragrances)
    .values({
      slug: SLUG,
      name: "Zz Worn",
      tagline: "t",
      story: "",
      mood: "m",
      palette: { bg: "#000000", deep: "#000000", accent: "#ffffff", ink: "#ffffff" },
      capFinish: "black",
      bottleImage: "/x.png",
      bottleAlt: "test bottle",
      published: true,
      sortOrder: 970,
    })
    .returning({ id: fragrances.id });
  fragranceId = f!.id;
  const [v] = await poolDb()
    .insert(variants)
    .values({ fragranceId, sku: SKU, sizeMl: 50, pricePoisha: 450_000, stock: 0 })
    .returning({ id: variants.id });
  await withTx((tx) => adjustStock(tx, { variantId: v!.id, delta: 5, type: "initial" }));
  await setSetting("payments", { sslcommerzEnabled: true, codEnabled: true });
  await setSetting("reviews", { show: true, askAfterDelivery: true });

  const items = [{ sku: SKU, qty: 1 }];
  const q = await quoteBag({ items, district: "Dhaka", area: "Dhanmondi" }, phone);
  const placed = await placeOrder(
    placeOrderSchema.parse({
      name: "Nusrat Jahan",
      phone,
      email: "reviewer@example.com",
      district: "Dhaka",
      area: "Dhanmondi",
      street: "House 1, Road 1",
      items,
      paymentMethod: "cod",
      expectedTotal: q.total,
      idempotencyKey: `${SLUG}-1`,
    }),
    phone,
  );
  number = placed.number;
  const [o] = await poolDb().select().from(orders).where(eq(orders.number, number));
  orderId = o!.id;
  token = o!.accessToken;
  itemId = (await poolDb().select().from(orderItems).where(eq(orderItems.orderId, orderId)))[0]!.id;
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 2500));
  const ids = (
    await poolDb()
      .select({ id: orders.id })
      .from(orders)
      .where(sql`${orders.idempotencyKey} like ${`${SLUG}-%`}`)
  ).map((o) => o.id);
  if (ids.length) await poolDb().delete(orders).where(inArray(orders.id, ids));
  await poolDb().delete(customers).where(eq(customers.phone, phone));
  await poolDb().delete(fragrances).where(eq(fragrances.id, fragranceId));
  await poolDb().execute(sql`delete from audit_log where actor_id = ${admin.id}`);
  await poolDb().delete(adminUsers).where(eq(adminUsers.id, admin.id));
  for (const [key, value] of saved) {
    if (value === undefined) await poolDb().delete(settings).where(eq(settings.key, key));
    else await poolDb().update(settings).set({ value }).where(eq(settings.key, key));
  }
  await integrationsTable.restore();
});

describe("reviews", () => {
  it("can't be written before the order is delivered", async () => {
    await expect(submitReview(review())).rejects.toThrow("once it's delivered");
    expect((await orderReviews(orderId))[0]).toMatchObject({ itemId, review: null });
  });

  it("asks once, by email, when the order is delivered", async () => {
    for (const to of ["packed", "shipped", "delivered"] as const)
      await withTx((tx) => transitionOrder(tx, orderId, to, { actor: "system" }));
    let o = (await poolDb().select().from(orders).where(eq(orders.id, orderId)))[0]!;
    for (let i = 0; i < 50 && !o.reviewAskedAt; i++) {
      await new Promise((r) => setTimeout(r, 100));
      o = (await poolDb().select().from(orders).where(eq(orders.id, orderId)))[0]!;
    }
    expect(o.reviewAskedAt).toBeTruthy();
    // The email lands in the dev outbox, written just after the stamp
    let sent: string[] = [];
    for (let i = 0; i < 30 && !sent.length; i++) {
      sent = (await readdir(OUTBOX_DIR)).filter((f) => f.includes(`review-ask-${number}`));
      if (!sent.length) await new Promise((r) => setTimeout(r, 100));
    }
    expect(sent.length).toBeGreaterThan(0);
  });

  it("takes one review per line from the order's buyer, and keeps it waiting", async () => {
    await expect(submitReview(review({ token: "x".repeat(32) }))).rejects.toThrow(
      "couldn't find that order",
    );
    await expect(submitReview(review({ itemId: itemId + 999_999 }))).rejects.toThrow(
      "isn't part of this order",
    );
    await submitReview(review({ body: "  Lasts all day.\r\n\r\n\r\nPeople asked.  " }));
    await expect(submitReview(review())).rejects.toThrow("already reviewed");
    const [r] = await poolDb().select().from(reviews).where(eq(reviews.orderItemId, itemId));
    expect(r).toMatchObject({
      status: "pending",
      rating: 5,
      fragranceId,
      body: "Lasts all day.\n\nPeople asked.",
    });
    expect((await orderReviews(orderId))[0]!.review).toEqual({ status: "pending", rating: 5 });
    expect((await pendingReviews()).count).toBeGreaterThan(0);
    expect((await attention()).some((a) => a.kind === "reviews")).toBe(true);
    // Not on the shop yet
    expect(await getReviews("fragrance", SLUG)).toBeNull();
  });

  it("reaches the shop once approved, with the house's reply", async () => {
    const [r] = await listReviewsAdmin("pending").then((l) =>
      l.filter((x) => x.orderId === orderId),
    );
    expect(r).toMatchObject({ orderNumber: number, fragrance: "Zz Worn", name: "Nusrat J." });
    await setReviewStatus(r!.id, "approved", admin);
    await replyToReview(r!.id, "  Thank you, Nusrat.  ", admin);
    const shop = await getReviews("fragrance", SLUG);
    expect(shop).toMatchObject({ average: 5, count: 1 });
    expect(shop!.reviews[0]).toMatchObject({ name: "Nusrat J.", reply: "Thank you, Nusrat." });

    // Switched off in Settings → Reviews, the shop shows none
    await setSetting("reviews", { show: false, askAfterDelivery: true });
    expect(await getReviews("fragrance", SLUG)).toBeNull();
    await setSetting("reviews", { show: true, askAfterDelivery: true });

    // Taken off the shop again
    await setReviewStatus(r!.id, "rejected", admin);
    expect(await getReviews("fragrance", SLUG)).toBeNull();
    const logged = await poolDb().execute(
      sql`select action from audit_log where actor_id = ${admin.id} order by id`,
    );
    expect(logged.rows.map((x) => (x as { action: string }).action)).toEqual([
      "review.approve",
      "review.reply",
      "review.reject",
    ]);
  });
});
