import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DiscoverySet } from "@/lib/discovery";
import type { Fragrance, NoteLayer } from "@/lib/fragrance";
import { getDb } from "./client";
import {
  discoverySetItems,
  discoverySets,
  fragranceImages,
  fragranceNotes,
  fragrances,
  notes,
  variants,
} from "./schema";
import { resolveBottle } from "@/lib/bottle";
import { DISCOVERY_SETS, FRAGRANCES } from "./seed-data";

/**
 * Catalogue reads. Postgres is the source of truth. If DATABASE_URL is missing or the database is
 * unreachable, these fall back to the typed seed data, so builds and previews never break.
 */
export async function getFragrances(): Promise<Fragrance[]> {
  const db = getDb();
  if (!db) return FRAGRANCES;
  try {
    const rows = await db
      .select()
      .from(fragrances)
      .where(eq(fragrances.published, true))
      .orderBy(asc(fragrances.sortOrder));
    if (!rows.length) return FRAGRANCES;
    const ids = rows.map((r) => r.id);
    const [noteRows, variantRows, imageRows] = await Promise.all([
      db
        .select({
          fragranceId: fragranceNotes.fragranceId,
          layer: fragranceNotes.layer,
          label: fragranceNotes.label,
          position: fragranceNotes.position,
          slug: notes.slug,
          name: notes.name,
          image: notes.image,
          alt: notes.alt,
        })
        .from(fragranceNotes)
        .innerJoin(notes, eq(notes.id, fragranceNotes.noteId))
        .where(inArray(fragranceNotes.fragranceId, ids)),
      db
        .select()
        .from(variants)
        .where(and(inArray(variants.fragranceId, ids), eq(variants.active, true)))
        .orderBy(asc(variants.sizeMl)),
      db
        .select()
        .from(fragranceImages)
        .where(inArray(fragranceImages.fragranceId, ids))
        .orderBy(asc(fragranceImages.position), asc(fragranceImages.id)),
    ]);
    return rows.map((f) => ({
      slug: f.slug,
      name: f.name,
      tagline: f.tagline,
      story: f.story,
      mood: f.mood,
      palette: f.palette,
      capFinish: f.capFinish,
      bottleImage: f.bottleImage,
      bottleAlt: f.bottleAlt,
      bottle: resolveBottle(f.slug, f.bottleMeta, f.bottleMaps),
      sortOrder: f.sortOrder,
      profile: f.profile ?? null,
      notes: noteRows
        .filter((n) => n.fragranceId === f.id)
        .map((n) => ({
          slug: n.slug,
          name: n.name,
          image: n.image,
          alt: n.alt,
          label: n.label,
          position: n.position,
          layer: n.layer as NoteLayer,
        }))
        .sort((a, b) => a.position - b.position),
      variants: variantRows
        .filter((v) => v.fragranceId === f.id)
        .map(({ sku, sizeMl, pricePoisha, stock }) => ({
          sku,
          sizeMl,
          pricePoisha,
          stock,
        })),
      images: imageRows
        .filter((i) => i.fragranceId === f.id)
        .map(({ url, alt, width, height }) => ({ url, alt, width, height })),
      badge: f.badge ?? null,
      howToWear: f.howToWear ?? null,
    }));
  } catch (err) {
    console.warn("[db] getFragrances failed, using seed data:", (err as Error).message);
    return FRAGRANCES;
  }
}

export async function getFragrance(slug: string): Promise<Fragrance | undefined> {
  return (await getFragrances()).find((f) => f.slug === slug);
}

/**
 * The published discovery sets, in order, each with its three fragrances (in box order) and its
 * pack. A set without an active pack isn't for sale and is left out. Falls back to the seed data
 * like getFragrances().
 */
export async function getDiscoverySets(): Promise<DiscoverySet[]> {
  const db = getDb();
  const fallback = () => DISCOVERY_SETS.filter((s) => s.variant);
  if (!db) return fallback();
  try {
    const rows = await db
      .select()
      .from(discoverySets)
      .where(eq(discoverySets.published, true))
      .orderBy(asc(discoverySets.sortOrder), asc(discoverySets.id));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const [items, packs] = await Promise.all([
      db
        .select({
          setId: discoverySetItems.setId,
          position: discoverySetItems.position,
          slug: fragrances.slug,
          name: fragrances.name,
          tagline: fragrances.tagline,
          bottleImage: fragrances.bottleImage,
          bottleAlt: fragrances.bottleAlt,
        })
        .from(discoverySetItems)
        .innerJoin(fragrances, eq(fragrances.id, discoverySetItems.fragranceId))
        .where(inArray(discoverySetItems.setId, ids))
        .orderBy(asc(discoverySetItems.position)),
      db
        .select()
        .from(variants)
        .where(and(inArray(variants.setId, ids), eq(variants.active, true)))
        .orderBy(asc(variants.id)),
    ]);
    return rows
      .map((s) => {
        const v = packs.find((p) => p.setId === s.id);
        return {
          slug: s.slug,
          name: s.name,
          tagline: s.tagline,
          story: s.story,
          image: s.image,
          imageAlt: s.imageAlt,
          width: s.imageWidth,
          height: s.imageHeight,
          sortOrder: s.sortOrder,
          fragrances: items
            .filter((i) => i.setId === s.id)
            .map(({ slug, name, tagline, bottleImage, bottleAlt }) => ({
              slug,
              name,
              tagline,
              bottleImage,
              bottleAlt,
            })),
          variant: v
            ? {
                sku: v.sku,
                sizeMl: v.sizeMl,
                pieces: v.pieces,
                pricePoisha: v.pricePoisha,
                stock: v.stock,
              }
            : null,
        };
      })
      .filter((s) => s.variant);
  } catch (err) {
    console.warn("[db] getDiscoverySets failed, using seed data:", (err as Error).message);
    return fallback();
  }
}
