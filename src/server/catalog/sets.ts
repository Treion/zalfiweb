import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import sharp from "sharp";
import type { z } from "zod";
import { discoverySetItems, discoverySets, fragrances, variants } from "@/db/schema";
import { audit, type Actor } from "@/server/audit";
import { poolDb, withTx, type Executor, type Tx } from "@/server/db/pool";
import { UserFacingError } from "@/server/errors";
import { storageProvider } from "@/server/providers/storage";
import { MAX_UPLOAD_BYTES, revalidateStorefront } from "./products";
import type { newSetSchema, setDetailsSchema, setFragrancesSchema, setPackSchema } from "./schema";
import { availableOf, reservedBy } from "./stock";

/**
 * Discovery sets, as the admin edits them: details, the three fragrances in the box, the box
 * photo and the pack (vial size and price). Stock is changed in Inventory, like any bottle. Each
 * change is one transaction with its audit row, then the storefront is refreshed.
 */

/** Every set holds one vial of each of its fragrances */
const PIECES = 3;

const hash8 = (b: Buffer) => createHash("sha256").update(b).digest("hex").slice(0, 10);

const skuFor = (slug: string, sizeMl: number) =>
  `ZLF-SET-${slug.toUpperCase()}-${PIECES}X${sizeMl}`;

/* ---------------------------------------------------------------------------------------------- */
/* Reading                                                                                          */

export type SetAdminRow = Awaited<ReturnType<typeof listSetsAdmin>>[number];

export async function listSetsAdmin(exec: Executor = poolDb()) {
  const sets = await exec
    .select()
    .from(discoverySets)
    .orderBy(asc(discoverySets.sortOrder), asc(discoverySets.id));
  if (!sets.length) return [];
  const ids = sets.map((s) => s.id);
  const [items, packs] = await Promise.all([
    exec
      .select({ setId: discoverySetItems.setId, name: fragrances.name })
      .from(discoverySetItems)
      .innerJoin(fragrances, eq(fragrances.id, discoverySetItems.fragranceId))
      .where(inArray(discoverySetItems.setId, ids))
      .orderBy(asc(discoverySetItems.position)),
    exec.select().from(variants).where(inArray(variants.setId, ids)),
  ]);
  const reserved = await reservedBy(
    exec,
    packs.map((p) => p.id),
  );
  return sets.map((s) => {
    const v = packs.find((p) => p.setId === s.id) ?? null;
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      image: s.image,
      imageAlt: s.imageAlt,
      published: s.published,
      contents: items.filter((i) => i.setId === s.id).map((i) => i.name),
      pack: v && {
        id: v.id,
        sku: v.sku,
        sizeMl: v.sizeMl,
        pieces: v.pieces,
        pricePoisha: v.pricePoisha,
        active: v.active,
        stock: v.stock,
        available: availableOf(v.stock, reserved.get(v.id) ?? 0),
      },
    };
  });
}

export async function getSetAdmin(id: number, exec: Executor = poolDb()) {
  const [set] = await exec.select().from(discoverySets).where(eq(discoverySets.id, id));
  if (!set) return null;
  const [items, [pack], library] = await Promise.all([
    exec
      .select({ fragranceId: discoverySetItems.fragranceId })
      .from(discoverySetItems)
      .where(eq(discoverySetItems.setId, id))
      .orderBy(asc(discoverySetItems.position)),
    exec.select().from(variants).where(eq(variants.setId, id)).limit(1),
    setFragranceChoices(exec),
  ]);
  return { set, fragranceIds: items.map((i) => i.fragranceId), pack: pack ?? null, library };
}

/** The fragrances a set can hold (hidden ones too, marked) */
export async function setFragranceChoices(exec: Executor = poolDb()) {
  return exec
    .select({ id: fragrances.id, name: fragrances.name, published: fragrances.published })
    .from(fragrances)
    .where(sql`${fragrances.slug} not like 'zz-%'`)
    .orderBy(asc(fragrances.sortOrder), asc(fragrances.name));
}

/* ---------------------------------------------------------------------------------------------- */
/* The box photo                                                                                    */

/**
 * The owner's box photo, kept whole: never cropped or recoloured, only scaled down to 2000 px on
 * the long side, as WebP. It must be cut out on a transparent background, like the bottles.
 */
async function storeBoxPhoto(slug: string, file: Buffer) {
  if (file.byteLength > MAX_UPLOAD_BYTES) throw new UserFacingError("That file is over 4 MB.");
  const meta = await sharp(file)
    .metadata()
    .catch(() => null);
  if (!meta?.width || !meta.height || !["png", "webp"].includes(meta.format ?? ""))
    throw new UserFacingError("Use a PNG or WebP photo.");
  if (!meta.hasAlpha) throw new UserFacingError("Use a photo cut out on a transparent background.");
  const { data, info } = await sharp(file)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer({ resolveWithObject: true });
  const { url } = await (
    await storageProvider()
  ).put(`sets/${slug}-${hash8(data)}.webp`, data, "image/webp");
  return { url, width: info.width, height: info.height };
}

/* ---------------------------------------------------------------------------------------------- */
/* Create and edit                                                                                  */

async function writeContents(tx: Tx, setId: number, fragranceIds: number[]) {
  const found = await tx
    .select({ id: fragrances.id })
    .from(fragrances)
    .where(inArray(fragrances.id, fragranceIds));
  if (found.length !== fragranceIds.length)
    throw new UserFacingError("One of those fragrances no longer exists.");
  await tx.delete(discoverySetItems).where(eq(discoverySetItems.setId, setId));
  await tx
    .insert(discoverySetItems)
    .values(fragranceIds.map((fragranceId, position) => ({ setId, fragranceId, position })));
}

/** A new set starts hidden, with no boxes in stock: add stock in Inventory, then publish */
export async function createSet(input: z.output<typeof newSetSchema>, photo: Buffer, actor: Actor) {
  const db = poolDb();
  const sku = skuFor(input.slug, input.sizeMl);
  const [taken] = await db
    .select({ id: discoverySets.id })
    .from(discoverySets)
    .where(eq(discoverySets.slug, input.slug));
  if (taken) throw new UserFacingError(`The name "${input.slug}" is already used by another set.`);
  const [skuTaken] = await db
    .select({ id: variants.id })
    .from(variants)
    .where(eq(variants.sku, sku));
  if (skuTaken) throw new UserFacingError(`The SKU ${sku} is already in use.`);
  const stored = await storeBoxPhoto(input.slug, photo);
  const [{ next }] = (await db
    .select({ next: sql<number>`coalesce(max(${discoverySets.sortOrder}), 0) + 1` })
    .from(discoverySets)) as [{ next: number }];
  const id = await withTx(async (tx) => {
    const [row] = await tx
      .insert(discoverySets)
      .values({
        slug: input.slug,
        name: input.name,
        tagline: input.tagline,
        imageAlt: input.imageAlt,
        image: stored.url,
        imageWidth: stored.width,
        imageHeight: stored.height,
        sortOrder: Number(next),
        published: false,
      })
      .returning({ id: discoverySets.id });
    await writeContents(tx, row!.id, input.fragranceIds);
    await tx.insert(variants).values({
      setId: row!.id,
      sku,
      sizeMl: input.sizeMl,
      pieces: PIECES,
      pricePoisha: input.pricePoisha,
      stock: 0,
    });
    await audit(tx, actor, "set.create", {
      entity: "discovery_set",
      entityId: row!.id,
      after: { ...input, sku, image: stored.url },
    });
    return row!.id;
  });
  return id;
}

export async function updateSet(
  id: number,
  input: z.output<typeof setDetailsSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(discoverySets).where(eq(discoverySets.id, id));
    if (!before) throw new UserFacingError("That set no longer exists.");
    if (input.published && !before.published) {
      const [pack] = await tx
        .select({ id: variants.id })
        .from(variants)
        .where(and(eq(variants.setId, id), eq(variants.active, true)));
      if (!pack) throw new UserFacingError("Switch the pack on before showing the set.");
    }
    await tx
      .update(discoverySets)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(discoverySets.id, id));
    await audit(tx, actor, "set.update", {
      entity: "discovery_set",
      entityId: id,
      before: {
        name: before.name,
        tagline: before.tagline,
        story: before.story,
        imageAlt: before.imageAlt,
        sortOrder: before.sortOrder,
        published: before.published,
      },
      after: input,
    });
  });
  await revalidateStorefront();
}

export async function setSetContents(
  id: number,
  fragranceIds: z.output<typeof setFragrancesSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [set] = await tx
      .select({ id: discoverySets.id })
      .from(discoverySets)
      .where(eq(discoverySets.id, id));
    if (!set) throw new UserFacingError("That set no longer exists.");
    const before = await tx
      .select({ fragranceId: discoverySetItems.fragranceId })
      .from(discoverySetItems)
      .where(eq(discoverySetItems.setId, id))
      .orderBy(asc(discoverySetItems.position));
    await writeContents(tx, id, fragranceIds);
    await audit(tx, actor, "set.contents", {
      entity: "discovery_set",
      entityId: id,
      before: { fragranceIds: before.map((b) => b.fragranceId) },
      after: { fragranceIds },
    });
  });
  await revalidateStorefront();
}

export async function replaceSetPhoto(id: number, file: Buffer, actor: Actor) {
  const [set] = await poolDb().select().from(discoverySets).where(eq(discoverySets.id, id));
  if (!set) throw new UserFacingError("That set no longer exists.");
  const stored = await storeBoxPhoto(set.slug, file);
  await withTx(async (tx) => {
    await tx
      .update(discoverySets)
      .set({
        image: stored.url,
        imageWidth: stored.width,
        imageHeight: stored.height,
        updatedAt: new Date(),
      })
      .where(eq(discoverySets.id, id));
    await audit(tx, actor, "set.photo", {
      entity: "discovery_set",
      entityId: id,
      before: { image: set.image },
      after: { image: stored.url },
    });
  });
  await revalidateStorefront();
  return stored.url;
}

/** The pack's vial size, price, low-stock level and on/off. Its SKU never changes. */
export async function updateSetPack(
  id: number,
  input: z.output<typeof setPackSchema>,
  actor: Actor,
) {
  await withTx(async (tx) => {
    const [before] = await tx.select().from(variants).where(eq(variants.setId, id));
    if (!before) throw new UserFacingError("That set has no pack.");
    if (!input.active) {
      const [shown] = await tx
        .select({ id: discoverySets.id })
        .from(discoverySets)
        .where(and(eq(discoverySets.id, id), eq(discoverySets.published, true)));
      if (shown) throw new UserFacingError("Hide the set before switching its pack off.");
    }
    await tx
      .update(variants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(variants.id, before.id));
    await audit(tx, actor, "set.pack", {
      entity: "variant",
      entityId: before.id,
      before: {
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
