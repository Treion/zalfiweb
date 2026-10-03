import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Fragrance, NoteLayer } from "@/lib/fragrance";
import { getDb } from "./client";
import { fragranceImages, fragranceNotes, fragrances, notes, variants } from "./schema";
import { resolveBottle } from "@/lib/bottle";
import { FRAGRANCES } from "./seed-data";

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
    }));
  } catch (err) {
    console.warn("[db] getFragrances failed, using seed data:", (err as Error).message);
    return FRAGRANCES;
  }
}

export async function getFragrance(slug: string): Promise<Fragrance | undefined> {
  return (await getFragrances()).find((f) => f.slug === slug);
}
