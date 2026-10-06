import "server-only";
import { cache } from "react";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { banners, fragrances, videos } from "@/db/schema";
import type { BannerPlacement, ShopBanner, ShopVideo } from "@/lib/content";

/**
 * Banners and videos for the shop: only those switched on (and, for banners, inside their dates).
 * Without a database, or if the read fails, there are none: the pages simply don't show them.
 */
export const getBanners = cache(async (placement: BannerPlacement): Promise<ShopBanner[]> => {
  const db = getDb();
  if (!db) return [];
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(banners)
      .where(
        and(
          eq(banners.placement, placement),
          eq(banners.active, true),
          or(isNull(banners.startsAt), lte(banners.startsAt, now)),
          or(isNull(banners.endsAt), gt(banners.endsAt, now)),
        ),
      )
      .orderBy(asc(banners.sortOrder), asc(banners.id));
    return rows.map((b) => ({
      id: b.id,
      image: { src: b.image, width: b.width, height: b.height },
      mobile:
        b.mobileImage && b.mobileWidth && b.mobileHeight
          ? { src: b.mobileImage, width: b.mobileWidth, height: b.mobileHeight }
          : null,
      alt: b.alt,
      headline: b.headline,
      line: b.line,
      buttonLabel: b.buttonLabel,
      link: b.link,
      tone: b.tone,
      textInImage: b.textInImage,
    }));
  } catch (err) {
    console.warn("[content] banners not shown:", (err as Error).message);
    return [];
  }
});

/** Videos about one perfume (its product page), or every one switched on (the shop) */
export const getVideos = cache(async (fragranceSlug?: string): Promise<ShopVideo[]> => {
  const db = getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({
        id: videos.id,
        youtubeId: videos.youtubeId,
        title: videos.title,
        channel: videos.channel,
      })
      .from(videos)
      .leftJoin(fragrances, eq(fragrances.id, videos.fragranceId))
      .where(
        and(
          eq(videos.active, true),
          fragranceSlug ? eq(fragrances.slug, fragranceSlug) : undefined,
        ),
      )
      .orderBy(asc(videos.sortOrder), asc(videos.id));
    return rows;
  } catch (err) {
    console.warn("[content] videos not shown:", (err as Error).message);
    return [];
  }
});
