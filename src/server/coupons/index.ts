import { asc, desc, eq, ne, sql } from "drizzle-orm";
import { coupons, discoverySets, fragrances, orders, variants } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { isUniqueViolation } from "@/server/db/errors";
import { UserFacingError } from "@/server/errors";
import type { CouponValues } from "./schema";

export type CouponRow = typeof coupons.$inferSelect;

export type CouponState = "active" | "scheduled" | "expired" | "used_up" | "off";

/** Where a coupon stands right now */
export function couponState(c: CouponRow, uses: number, now = new Date()): CouponState {
  if (!c.active) return "off";
  if (c.endsAt && c.endsAt <= now) return "expired";
  if (c.usageLimit !== null && uses >= c.usageLimit) return "used_up";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

/** Every coupon with its performance: uses, revenue and discount given (cancelled orders excluded) */
export async function listCouponsAdmin(exec: Executor = poolDb()) {
  const stats = exec
    .select({
      couponId: orders.couponId,
      uses: sql<number>`count(*)::int`.as("uses"),
      revenue: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`.as("revenue"),
      discount: sql<number>`coalesce(sum(${orders.discount}), 0)::bigint`.as("discount"),
      lastUsed: sql<Date | null>`max(${orders.createdAt})`.as("last_used"),
    })
    .from(orders)
    .where(ne(orders.status, "cancelled"))
    .groupBy(orders.couponId)
    .as("stats");
  const rows = await exec
    .select({
      coupon: coupons,
      uses: stats.uses,
      revenue: stats.revenue,
      discount: stats.discount,
      lastUsed: stats.lastUsed,
    })
    .from(coupons)
    .leftJoin(stats, eq(stats.couponId, coupons.id))
    .orderBy(desc(coupons.active), asc(coupons.code));
  const now = new Date();
  return rows.map((r) => {
    const uses = Number(r.uses ?? 0);
    return {
      ...r.coupon,
      uses,
      revenue: Number(r.revenue ?? 0),
      discountGiven: Number(r.discount ?? 0),
      lastUsed: r.lastUsed ? new Date(r.lastUsed) : null,
      state: couponState(r.coupon, uses, now),
    };
  });
}

export type CouponListRow = Awaited<ReturnType<typeof listCouponsAdmin>>[number];

export async function getCouponAdmin(id: number, exec: Executor = poolDb()) {
  return (await listCouponsAdmin(exec)).find((c) => c.id === id) ?? null;
}

export async function saveCoupon(id: number | null, v: CouponValues, actor: Actor) {
  try {
    return await withTx(async (tx) => {
      const values = { ...v, updatedAt: new Date() };
      if (id === null) {
        const [row] = await tx.insert(coupons).values(values).returning();
        await audit(tx, actor, "coupon.create", {
          entity: "coupon",
          entityId: row!.id,
          after: row,
        });
        return row!;
      }
      const [before] = await tx.select().from(coupons).where(eq(coupons.id, id)).for("update");
      if (!before) throw new UserFacingError("That coupon no longer exists.");
      const [row] = await tx.update(coupons).set(values).where(eq(coupons.id, id)).returning();
      await audit(tx, actor, "coupon.update", {
        entity: "coupon",
        entityId: id,
        before,
        after: row,
      });
      return row!;
    });
  } catch (e) {
    if (isUniqueViolation(e))
      throw new UserFacingError(`There is already a coupon called ${v.code}.`);
    throw e;
  }
}

export async function setCouponActive(id: number, active: boolean, actor: Actor) {
  await withTx(async (tx) => {
    const [row] = await tx
      .update(coupons)
      .set({ active, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning({ code: coupons.code });
    if (!row) throw new UserFacingError("That coupon no longer exists.");
    await audit(tx, actor, active ? "coupon.activate" : "coupon.deactivate", {
      entity: "coupon",
      entityId: id,
      after: { code: row.code, active },
    });
  });
}

/** Only a coupon that was never used can be deleted; a used one is switched off instead */
export async function deleteCoupon(id: number, actor: Actor) {
  await withTx(async (tx) => {
    const [used] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.couponId, id));
    if (Number(used?.n ?? 0) > 0)
      throw new UserFacingError(
        "This coupon has been used, so it stays on record. Switch it off instead.",
      );
    const [row] = await tx.delete(coupons).where(eq(coupons.id, id)).returning();
    if (!row) throw new UserFacingError("That coupon no longer exists.");
    await audit(tx, actor, "coupon.delete", { entity: "coupon", entityId: id, before: row });
  });
}

/** Fragrances and their sizes, then the discovery sets and their packs, for "applies to" */
export async function couponTargets(exec: Executor = poolDb()) {
  const [rows, sets] = await Promise.all([
    exec
      .select({
        id: fragrances.id,
        name: fragrances.name,
        published: fragrances.published,
        variantId: variants.id,
        sizeMl: variants.sizeMl,
      })
      .from(fragrances)
      .leftJoin(variants, eq(variants.fragranceId, fragrances.id))
      .orderBy(asc(fragrances.sortOrder), asc(fragrances.name), asc(variants.sizeMl)),
    exec
      .select({
        id: discoverySets.id,
        name: discoverySets.name,
        published: discoverySets.published,
        variantId: variants.id,
        sizeMl: variants.sizeMl,
        pieces: variants.pieces,
      })
      .from(discoverySets)
      .innerJoin(variants, eq(variants.setId, discoverySets.id))
      .orderBy(asc(discoverySets.sortOrder), asc(discoverySets.name)),
  ]);
  const out: {
    kind: "fragrance" | "set";
    id: number;
    name: string;
    published: boolean;
    sizes: { id: number; sizeMl: number; pieces: number }[];
  }[] = [];
  for (const r of rows) {
    let f = out.find((x) => x.id === r.id);
    if (!f)
      out.push(
        (f = { kind: "fragrance", id: r.id, name: r.name, published: r.published, sizes: [] }),
      );
    if (r.variantId) f.sizes.push({ id: r.variantId, sizeMl: r.sizeMl!, pieces: 1 });
  }
  // A set is chosen by its pack (a coupon's variantIds): one for a fragrance never reaches it
  for (const r of sets)
    out.push({
      kind: "set",
      id: r.id,
      name: r.name,
      published: r.published,
      sizes: [{ id: r.variantId, sizeMl: r.sizeMl, pieces: r.pieces }],
    });
  return out;
}

export type CouponTarget = Awaited<ReturnType<typeof couponTargets>>[number];
