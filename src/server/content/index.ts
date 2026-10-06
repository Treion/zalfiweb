import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { banners, fragrances, videos } from "@/db/schema";
import { youtubeIdOf, type BannerPlacement } from "@/lib/content";
import type { BannerDetails, videoInputSchema } from "@/lib/content-schema";
import type { z } from "zod";
import { audit, type Actor } from "@/server/audit";
import { revalidateStorefront } from "@/server/catalog/products";
import { dropUpload, storeWebp } from "@/server/catalog/upload";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";

/**
 * Admin → Content: the banners a designer made and the YouTube videos the owner adds. Every change
 * is one transaction with its audit row, then the shop is refreshed. Pictures are stored whole as
 * WebP (never cropped): the wide one fits inside 2560 px, the phone one inside 1600 px.
 */

const empty = (v: string) => v || null;
const toDate = (v: string | null) => (v ? new Date(v) : null);

/* ---------------------------------------------------------------------------------------------- */
/* Banners                                                                                          */

export async function listBannersAdmin(exec: Executor = poolDb()) {
  return exec.select().from(banners).orderBy(asc(banners.placement), asc(banners.sortOrder));
}
export type AdminBanner = Awaited<ReturnType<typeof listBannersAdmin>>[number];

async function getBanner(exec: Executor, id: number) {
  const [b] = await exec.select().from(banners).where(eq(banners.id, id)).for("update");
  if (!b) throw new UserFacingError("That banner no longer exists.");
  return b;
}

/** A new banner from its wide picture; the words, link and dates are set on its card */
export async function createBanner(
  placement: BannerPlacement,
  alt: string,
  file: Buffer,
  actor: Actor,
) {
  const img = await storeWebp(file, `content/banner`, 2560);
  const id = await withTx(async (tx) => {
    const [{ next }] = (await tx
      .select({ next: sql<number>`coalesce(max(${banners.sortOrder}), -1) + 1` })
      .from(banners)
      .where(eq(banners.placement, placement))) as [{ next: number }];
    const [row] = await tx
      .insert(banners)
      .values({
        placement,
        image: img.url,
        width: img.width,
        height: img.height,
        alt,
        sortOrder: Number(next),
      })
      .returning({ id: banners.id });
    await audit(tx, actor, "banner.create", {
      entity: "banner",
      entityId: row!.id,
      after: { placement, image: img.url, alt },
    });
    return row!.id;
  });
  await revalidateStorefront();
  return { id };
}

export async function updateBanner(id: number, d: BannerDetails, actor: Actor) {
  await withTx(async (tx) => {
    const before = await getBanner(tx, id);
    const after = {
      alt: d.alt,
      headline: empty(d.headline),
      line: empty(d.line),
      buttonLabel: empty(d.buttonLabel),
      link: empty(d.link),
      tone: d.tone,
      textInImage: d.textInImage,
      active: d.active,
      startsAt: toDate(d.startsAt),
      endsAt: toDate(d.endsAt),
    };
    await tx
      .update(banners)
      .set({ ...after, updatedAt: new Date() })
      .where(eq(banners.id, id));
    await audit(tx, actor, "banner.update", {
      entity: "banner",
      entityId: id,
      before: {
        alt: before.alt,
        headline: before.headline,
        line: before.line,
        buttonLabel: before.buttonLabel,
        link: before.link,
        tone: before.tone,
        textInImage: before.textInImage,
        active: before.active,
        startsAt: before.startsAt,
        endsAt: before.endsAt,
      },
      after,
    });
  });
  await revalidateStorefront();
}

/** Replaces the wide picture, or sets the phone one */
export async function setBannerImage(
  id: number,
  which: "wide" | "phone",
  file: Buffer,
  actor: Actor,
) {
  const img = await storeWebp(file, `content/banner`, which === "wide" ? 2560 : 1600);
  const old = await withTx(async (tx) => {
    const b = await getBanner(tx, id);
    const set =
      which === "wide"
        ? { image: img.url, width: img.width, height: img.height }
        : { mobileImage: img.url, mobileWidth: img.width, mobileHeight: img.height };
    await tx
      .update(banners)
      .set({ ...set, updatedAt: new Date() })
      .where(eq(banners.id, id));
    const before = which === "wide" ? b.image : b.mobileImage;
    await audit(tx, actor, `banner.image.${which}`, {
      entity: "banner",
      entityId: id,
      before: { url: before },
      after: { url: img.url },
    });
    return before;
  });
  if (old && old !== img.url) await dropUpload(old);
  await revalidateStorefront();
}

/** The phone picture goes; the wide one is used everywhere again */
export async function removeBannerPhoneImage(id: number, actor: Actor) {
  const old = await withTx(async (tx) => {
    const b = await getBanner(tx, id);
    await tx
      .update(banners)
      .set({ mobileImage: null, mobileWidth: null, mobileHeight: null, updatedAt: new Date() })
      .where(eq(banners.id, id));
    await audit(tx, actor, "banner.image.phone.remove", {
      entity: "banner",
      entityId: id,
      before: { url: b.mobileImage },
    });
    return b.mobileImage;
  });
  if (old) await dropUpload(old);
  await revalidateStorefront();
}

/** Swaps a banner with its neighbour in the same place (up: -1, down: 1) */
export async function moveBanner(id: number, dir: -1 | 1, actor: Actor) {
  await withTx(async (tx) => {
    const b = await getBanner(tx, id);
    const [other] = await tx
      .select()
      .from(banners)
      .where(
        and(
          eq(banners.placement, b.placement),
          dir < 0 ? lt(banners.sortOrder, b.sortOrder) : gt(banners.sortOrder, b.sortOrder),
        ),
      )
      .orderBy(dir < 0 ? sql`${banners.sortOrder} desc` : asc(banners.sortOrder))
      .limit(1);
    if (!other) return;
    await tx.update(banners).set({ sortOrder: other.sortOrder }).where(eq(banners.id, b.id));
    await tx.update(banners).set({ sortOrder: b.sortOrder }).where(eq(banners.id, other.id));
    await audit(tx, actor, "banner.move", { entity: "banner", entityId: id, after: { dir } });
  });
  await revalidateStorefront();
}

export async function deleteBanner(id: number, actor: Actor) {
  const b = await withTx(async (tx) => {
    const b = await getBanner(tx, id);
    await tx.delete(banners).where(eq(banners.id, id));
    await audit(tx, actor, "banner.delete", {
      entity: "banner",
      entityId: id,
      before: { placement: b.placement, image: b.image, alt: b.alt },
    });
    return b;
  });
  await dropUpload(b.image);
  if (b.mobileImage) await dropUpload(b.mobileImage);
  await revalidateStorefront();
}

/* ---------------------------------------------------------------------------------------------- */
/* Videos                                                                                           */

export async function listVideosAdmin(exec: Executor = poolDb()) {
  return exec
    .select({
      id: videos.id,
      youtubeId: videos.youtubeId,
      title: videos.title,
      channel: videos.channel,
      fragranceId: videos.fragranceId,
      fragrance: fragrances.name,
      active: videos.active,
      sortOrder: videos.sortOrder,
    })
    .from(videos)
    .leftJoin(fragrances, eq(fragrances.id, videos.fragranceId))
    .orderBy(asc(videos.sortOrder), asc(videos.id));
}
export type AdminVideo = Awaited<ReturnType<typeof listVideosAdmin>>[number];

type VideoInput = z.output<typeof videoInputSchema>;
const videoValues = (v: VideoInput) => ({
  youtubeId: youtubeIdOf(v.url)!,
  title: v.title,
  channel: empty(v.channel),
  fragranceId: v.fragranceId,
  active: v.active,
});

export async function createVideo(v: VideoInput, actor: Actor) {
  const id = await withTx(async (tx) => {
    const [{ next }] = (await tx
      .select({ next: sql<number>`coalesce(max(${videos.sortOrder}), -1) + 1` })
      .from(videos)) as [{ next: number }];
    const [row] = await tx
      .insert(videos)
      .values({ ...videoValues(v), sortOrder: Number(next) })
      .returning({ id: videos.id });
    await audit(tx, actor, "video.create", {
      entity: "video",
      entityId: row!.id,
      after: videoValues(v),
    });
    return row!.id;
  });
  await revalidateStorefront();
  return { id };
}

export async function updateVideo(id: number, v: VideoInput, actor: Actor) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(videos).where(eq(videos.id, id)).for("update");
    if (!before) throw new UserFacingError("That video no longer exists.");
    await tx.update(videos).set(videoValues(v)).where(eq(videos.id, id));
    await audit(tx, actor, "video.update", {
      entity: "video",
      entityId: id,
      before: {
        youtubeId: before.youtubeId,
        title: before.title,
        channel: before.channel,
        fragranceId: before.fragranceId,
        active: before.active,
      },
      after: videoValues(v),
    });
  });
  await revalidateStorefront();
}

export async function moveVideo(id: number, dir: -1 | 1, actor: Actor) {
  await withTx(async (tx) => {
    const all = await tx
      .select({ id: videos.id, sortOrder: videos.sortOrder })
      .from(videos)
      .orderBy(asc(videos.sortOrder), asc(videos.id))
      .for("update");
    const i = all.findIndex((v) => v.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j]!, all[i]!];
    for (const [n, v] of all.entries())
      await tx.update(videos).set({ sortOrder: n }).where(eq(videos.id, v.id));
    await audit(tx, actor, "video.move", { entity: "video", entityId: id, after: { dir } });
  });
  await revalidateStorefront();
}

export async function deleteVideo(id: number, actor: Actor) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(videos).where(eq(videos.id, id)).for("update");
    if (!before) throw new UserFacingError("That video no longer exists.");
    await tx.delete(videos).where(eq(videos.id, id));
    await audit(tx, actor, "video.delete", {
      entity: "video",
      entityId: id,
      before: { youtubeId: before.youtubeId, title: before.title },
    });
  });
  await revalidateStorefront();
}
