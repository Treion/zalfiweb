import { createHash } from "node:crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import sharp from "sharp";
import type { z } from "zod";
import {
  fragranceImages,
  fragranceNotes,
  fragrances,
  notes,
  orderItems,
  variants,
} from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { storageProvider } from "@/server/providers/storage";
import { getSettings } from "@/server/settings";
import { bakeBottle, checkBottlePhoto } from "./bake";
import type {
  fragranceDetailsSchema,
  newFragranceSchema,
  notesSchema,
  variantSchema,
} from "./schema";
import { adjustStock, reservedBy } from "./stock";

/**
 * The catalogue, as the admin edits it. Every change is one transaction with its audit row, then
 * the storefront is refreshed (revalidateStorefront), so edits show on the site at once.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Refreshes every storefront page (they are statically generated and re-generated on demand) */
export async function revalidateStorefront() {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
  } catch {
    /* outside a Next request (scripts): nothing to refresh */
  }
}

const hash8 = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 10);

async function storage() {
  return storageProvider((await getSettings("integrations")).storage);
}

/* ---------------------------------------------------------------------------------------------- */
/* Reading                                                                                          */

export async function listProductsAdmin(exec: Executor = poolDb()) {
  const rows = await exec
    .select()
    .from(fragrances)
    .orderBy(asc(fragrances.sortOrder), asc(fragrances.id));
  const ids = rows.map((r) => r.id);
  const vs = ids.length
    ? await exec
        .select()
        .from(variants)
        .where(inArray(variants.fragranceId, ids))
        .orderBy(asc(variants.sizeMl))
    : [];
  const reserved = await reservedBy(
    exec,
    vs.map((v) => v.id),
  );
  return rows.map((f) => ({
    id: f.id,
    slug: f.slug,
    name: f.name,
    tagline: f.tagline,
    published: f.published,
    bottleImage: f.bottleImage,
    sortOrder: f.sortOrder,
    palette: f.palette,
    variants: vs
      .filter((v) => v.fragranceId === f.id)
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        sizeMl: v.sizeMl,
        pricePoisha: v.pricePoisha,
        stock: v.stock,
        reserved: reserved.get(v.id) ?? 0,
        active: v.active,
      })),
  }));
}

export async function getProductAdmin(id: number, exec: Executor = poolDb()) {
  const [f] = await exec.select().from(fragrances).where(eq(fragrances.id, id));
  if (!f) return null;
  const [vs, ns, imgs, library] = await Promise.all([
    exec.select().from(variants).where(eq(variants.fragranceId, id)).orderBy(asc(variants.sizeMl)),
    exec
      .select({
        noteSlug: notes.slug,
        name: notes.name,
        layer: fragranceNotes.layer,
        label: fragranceNotes.label,
        position: fragranceNotes.position,
      })
      .from(fragranceNotes)
      .innerJoin(notes, eq(notes.id, fragranceNotes.noteId))
      .where(eq(fragranceNotes.fragranceId, id))
      .orderBy(asc(fragranceNotes.position)),
    exec
      .select()
      .from(fragranceImages)
      .where(eq(fragranceImages.fragranceId, id))
      .orderBy(asc(fragranceImages.position), asc(fragranceImages.id)),
    exec.select({ slug: notes.slug, name: notes.name }).from(notes).orderBy(asc(notes.name)),
  ]);
  const reserved = await reservedBy(
    exec,
    vs.map((v) => v.id),
  );
  return {
    fragrance: f,
    variants: vs.map((v) => ({ ...v, reserved: reserved.get(v.id) ?? 0 })),
    notes: ns,
    images: imgs,
    noteLibrary: library,
  };
}

/* ---------------------------------------------------------------------------------------------- */
/* Bottle photo                                                                                     */

/** Bakes and stores a bottle photo: the PNG itself plus its three relighting maps */
async function storeBottle(slug: string, file: Buffer) {
  const problem = await checkBottlePhoto(file);
  if (problem) throw new UserFacingError(problem);
  // Normalise to PNG (the bake and the storefront expect a transparent PNG)
  const png = await sharp(file).png({ compressionLevel: 9 }).toBuffer();
  const baked = await bakeBottle(png, slug);
  const store = await storage();
  const base = `bottles/${slug}-${hash8(png)}`;
  const [photo] = await Promise.all([
    store.put(`${base}.png`, png, "image/png"),
    store.put(`${base}-color.webp`, baked.color, "image/webp"),
    store.put(`${base}-normal.webp`, baked.normal, "image/webp"),
    store.put(`${base}-mask.webp`, baked.mask, "image/webp"),
  ]);
  return { url: photo.url, maps: photo.url.replace(/\.png$/, ""), meta: baked.meta };
}

export async function replaceBottlePhoto(id: number, file: Buffer, actor: Actor) {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const [f] = await poolDb().select().from(fragrances).where(eq(fragrances.id, id));
  if (!f) throw new UserFacingError("That fragrance no longer exists.");
  const stored = await storeBottle(f.slug, file);
  await withTx(async (tx) => {
    await tx
      .update(fragrances)
      .set({
        bottleImage: stored.url,
        bottleMeta: stored.meta,
        bottleMaps: stored.maps,
        updatedAt: new Date(),
      })
      .where(eq(fragrances.id, id));
    await audit(tx, actor, "product.bottle.replace", {
      entity: "fragrance",
      entityId: id,
      before: { bottleImage: f.bottleImage },
      after: { bottleImage: stored.url, trim: stored.meta.trim },
    });
  });
  await revalidateStorefront();
  return stored.url;
}

/* ---------------------------------------------------------------------------------------------- */
/* Create and edit                                                                                  */

export async function createFragrance(
  input: z.output<typeof newFragranceSchema>,
  photo: Buffer,
  actor: Actor,
) {
  if (photo.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const db = poolDb();
  const [taken] = await db
    .select({ id: fragrances.id })
    .from(fragrances)
    .where(eq(fragrances.slug, input.slug));
  if (taken)
    throw new UserFacingError(
      `The web address "${input.slug}" is already used by another fragrance.`,
    );
  const stored = await storeBottle(input.slug, photo);
  const [{ next }] = (await db
    .select({ next: sql<number>`coalesce(max(${fragrances.sortOrder}), 0) + 1` })
    .from(fragrances)) as [{ next: number }];
  const id = await withTx(async (tx) => {
    const [row] = await tx
      .insert(fragrances)
      .values({
        slug: input.slug,
        name: input.name,
        tagline: input.tagline,
        mood: input.mood,
        story: "",
        palette: input.palette,
        capFinish: input.capFinish,
        bottleImage: stored.url,
        bottleAlt: `ZALFI ${input.name} eau de parfum bottle`,
        bottleMeta: stored.meta,
        bottleMaps: stored.maps,
        sortOrder: Number(next),
        // New fragrances start hidden: publish once sizes, prices and notes are in
        published: false,
      })
      .returning({ id: fragrances.id });
    await audit(tx, actor, "product.create", {
      entity: "fragrance",
      entityId: row!.id,
      after: { ...input },
    });
    return row!.id;
  });
  return id;
}

export async function updateFragrance(
  id: number,
  input: z.output<typeof fragranceDetailsSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(fragrances).where(eq(fragrances.id, id));
    if (!before) throw new UserFacingError("That fragrance no longer exists.");
    if (input.published && !before.published) {
      const [sizes] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(variants)
        .where(and(eq(variants.fragranceId, id), eq(variants.active, true)));
      if (!Number(sizes?.n))
        throw new UserFacingError("Add at least one size with a price before publishing.");
    }
    await tx
      .update(fragrances)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(fragrances.id, id));
    const pick = (o: typeof before) => ({
      name: o.name,
      tagline: o.tagline,
      mood: o.mood,
      story: o.story,
      bottleAlt: o.bottleAlt,
      capFinish: o.capFinish,
      palette: o.palette,
      profile: o.profile,
      sortOrder: o.sortOrder,
      published: o.published,
    });
    await audit(tx, actor, "product.update", {
      entity: "fragrance",
      entityId: id,
      before: pick(before),
      after: input,
    });
  });
  await revalidateStorefront();
}

export async function setFragranceNotes(
  id: number,
  list: z.output<typeof notesSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const slugs = [...new Set(list.map((n) => n.noteSlug))];
    const lib = slugs.length
      ? await tx
          .select({ id: notes.id, slug: notes.slug })
          .from(notes)
          .where(inArray(notes.slug, slugs))
      : [];
    const idOf = new Map(lib.map((n) => [n.slug, n.id]));
    for (const s of slugs) if (!idOf.has(s)) throw new UserFacingError(`Unknown note "${s}".`);
    const seen = new Set<string>();
    for (const n of list) {
      const k = `${n.noteSlug}:${n.layer}`;
      if (seen.has(k)) throw new UserFacingError("A note appears twice in the same layer.");
      seen.add(k);
    }
    const before = await tx.select().from(fragranceNotes).where(eq(fragranceNotes.fragranceId, id));
    await tx.delete(fragranceNotes).where(eq(fragranceNotes.fragranceId, id));
    if (list.length)
      await tx.insert(fragranceNotes).values(
        list.map((n, i) => ({
          fragranceId: id,
          noteId: idOf.get(n.noteSlug)!,
          layer: n.layer,
          label: n.label,
          position: i,
        })),
      );
    await audit(tx, actor, "product.notes", {
      entity: "fragrance",
      entityId: id,
      before: before.map((b) => ({ layer: b.layer, label: b.label })),
      after: list,
    });
  });
  await revalidateStorefront();
}

/* ---------------------------------------------------------------------------------------------- */
/* Sizes                                                                                            */

export async function createVariant(
  fragranceId: number,
  input: z.output<typeof variantSchema>,
  openingStock: number,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [dup] = await tx
      .select({ id: variants.id })
      .from(variants)
      .where(eq(variants.sku, input.sku));
    if (dup) throw new UserFacingError(`The SKU ${input.sku} is already in use.`);
    const [same] = await tx
      .select({ id: variants.id })
      .from(variants)
      .where(and(eq(variants.fragranceId, fragranceId), eq(variants.sizeMl, input.sizeMl)));
    if (same) throw new UserFacingError(`This fragrance already has a ${input.sizeMl} ml size.`);
    const [v] = await tx
      .insert(variants)
      .values({ ...input, fragranceId, stock: 0 })
      .returning({ id: variants.id });
    if (openingStock > 0)
      await adjustStock(tx, {
        variantId: v!.id,
        delta: openingStock,
        type: "initial",
        reason: "Opening stock",
        adminUserId: actor.id,
      });
    await audit(tx, actor, "product.size.create", {
      entity: "variant",
      entityId: v!.id,
      after: { ...input, openingStock },
    });
  });
  await revalidateStorefront();
}

export async function updateVariant(
  id: number,
  input: z.output<typeof variantSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(variants).where(eq(variants.id, id));
    if (!before) throw new UserFacingError("That size no longer exists.");
    const [dup] = await tx
      .select({ id: variants.id })
      .from(variants)
      .where(and(eq(variants.sku, input.sku), ne(variants.id, id)));
    if (dup) throw new UserFacingError(`The SKU ${input.sku} is already in use.`);
    if (input.sku !== before.sku) {
      const [sold] = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.variantId, id))
        .limit(1);
      if (sold)
        throw new UserFacingError(
          "This size has orders, so its SKU can't change. Add a new size instead.",
        );
    }
    await tx
      .update(variants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(variants.id, id));
    await audit(tx, actor, "product.size.update", {
      entity: "variant",
      entityId: id,
      before: {
        sku: before.sku,
        sizeMl: before.sizeMl,
        pricePoisha: before.pricePoisha,
        lowStockThreshold: before.lowStockThreshold,
        active: before.active,
      },
      after: input,
    });
  });
  await revalidateStorefront();
}

/* ---------------------------------------------------------------------------------------------- */
/* Gallery images                                                                                   */

export async function addImage(fragranceId: number, file: Buffer, alt: string, actor: Actor) {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const meta = await sharp(file)
    .metadata()
    .catch(() => null);
  if (!meta?.width || !meta.height || !["jpeg", "png", "webp", "avif"].includes(meta.format ?? ""))
    throw new UserFacingError("Use a JPG, PNG, WebP or AVIF image.");
  // Stored as WebP, at most 2400 px on the long side, never upscaled or cropped
  const img = sharp(file)
    .rotate()
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const { data, info } = await img.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  const [f] = await poolDb()
    .select({ slug: fragrances.slug })
    .from(fragrances)
    .where(eq(fragrances.id, fragranceId));
  if (!f) throw new UserFacingError("That fragrance no longer exists.");
  const { url } = await (
    await storage()
  ).put(`products/${f.slug}-${hash8(data)}.webp`, data, "image/webp");
  await withTx(async (tx) => {
    const [{ pos }] = (await tx
      .select({ pos: sql<number>`coalesce(max(${fragranceImages.position}), -1) + 1` })
      .from(fragranceImages)
      .where(eq(fragranceImages.fragranceId, fragranceId))) as [{ pos: number }];
    const [row] = await tx
      .insert(fragranceImages)
      .values({
        fragranceId,
        url,
        alt,
        position: Number(pos),
        width: info.width,
        height: info.height,
      })
      .returning({ id: fragranceImages.id });
    await audit(tx, actor, "product.image.add", {
      entity: "fragrance",
      entityId: fragranceId,
      after: { imageId: row!.id, url, alt },
    });
  });
  await revalidateStorefront();
}

export async function updateImageAlt(imageId: number, alt: string, actor: Actor) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(fragranceImages).where(eq(fragranceImages.id, imageId));
    if (!before) throw new UserFacingError("That image no longer exists.");
    await tx.update(fragranceImages).set({ alt }).where(eq(fragranceImages.id, imageId));
    await audit(tx, actor, "product.image.alt", {
      entity: "fragrance",
      entityId: before.fragranceId,
      before: { alt: before.alt },
      after: { alt },
    });
  });
  await revalidateStorefront();
}

export async function reorderImages(fragranceId: number, orderedIds: number[], actor: Actor) {
  await withTx(async (tx) => {
    const rows = await tx
      .select({ id: fragranceImages.id })
      .from(fragranceImages)
      .where(eq(fragranceImages.fragranceId, fragranceId));
    const known = new Set(rows.map((r) => r.id));
    if (orderedIds.length !== known.size || orderedIds.some((id) => !known.has(id)))
      throw new UserFacingError(
        "The images changed while you were reordering. Reload and try again.",
      );
    for (const [i, id] of orderedIds.entries())
      await tx.update(fragranceImages).set({ position: i }).where(eq(fragranceImages.id, id));
    await audit(tx, actor, "product.image.reorder", {
      entity: "fragrance",
      entityId: fragranceId,
      after: { order: orderedIds },
    });
  });
  await revalidateStorefront();
}

export async function deleteImage(imageId: number, actor: Actor) {
  const [img] = await poolDb()
    .select()
    .from(fragranceImages)
    .where(eq(fragranceImages.id, imageId));
  if (!img) throw new UserFacingError("That image no longer exists.");
  await withTx(async (tx) => {
    await tx.delete(fragranceImages).where(eq(fragranceImages.id, imageId));
    await audit(tx, actor, "product.image.delete", {
      entity: "fragrance",
      entityId: img.fragranceId,
      before: { url: img.url, alt: img.alt },
    });
  });
  await (await storage()).remove(img.url).catch(() => {});
  await revalidateStorefront();
}
