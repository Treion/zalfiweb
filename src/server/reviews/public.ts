import "server-only";
import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { discoverySets, fragrances, reviews } from "@/db/schema";
import { averageOf, type ReviewSummary } from "@/lib/reviews";
import { getSettings } from "@/server/settings";

/** How many approved reviews a page lists (the average counts them all) */
const SHOWN = 12;

/**
 * A fragrance's or a set's approved reviews, for the shop. Null when there are none yet, when the
 * owner has switched reviews off (Settings → Reviews), or without a database: the section then
 * doesn't render at all, so it never looks empty.
 */
export const getReviews = cache(
  async (kind: "fragrance" | "set", slug: string): Promise<ReviewSummary | null> => {
    const db = getDb();
    if (!db) return null;
    try {
      const { show } = await getSettings("reviews");
      if (!show) return null;
      const owner = kind === "fragrance" ? eq(fragrances.slug, slug) : eq(discoverySets.slug, slug);
      const rows = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          body: reviews.body,
          name: reviews.displayName,
          createdAt: reviews.createdAt,
          reply: reviews.reply,
        })
        .from(reviews)
        .leftJoin(fragrances, eq(fragrances.id, reviews.fragranceId))
        .leftJoin(discoverySets, eq(discoverySets.id, reviews.setId))
        .where(and(eq(reviews.status, "approved"), owner))
        .orderBy(desc(reviews.createdAt));
      if (!rows.length) return null;
      return {
        average: averageOf(rows.map((r) => r.rating)),
        count: rows.length,
        reviews: rows.slice(0, SHOWN).map((r) => ({
          id: r.id,
          rating: r.rating,
          body: r.body,
          name: r.name,
          date: r.createdAt.toISOString(),
          reply: r.reply,
        })),
      };
    } catch (err) {
      console.warn("[reviews] not shown:", (err as Error).message);
      return null;
    }
  },
);
