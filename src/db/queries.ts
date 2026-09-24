import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import type { Fragrance, NoteLayer } from "@/lib/fragrance";
import { getDb } from "./client";
import { fragranceNotes, fragrances, notes, variants } from "./schema";
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
    const [noteRows, variantRows] = await Promise.all([
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
        .where(inArray(variants.fragranceId, ids))
        .orderBy(asc(variants.sizeMl)),
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
        .map(({ sku, sizeMl, priceCents, currency, stock }) => ({
          sku,
          sizeMl,
          priceCents,
          currency,
          stock,
        })),
    }));
  } catch (err) {
    console.warn("[db] getFragrances failed, using seed data:", (err as Error).message);
    return FRAGRANCES;
  }
}

export async function getFragrance(slug: string): Promise<Fragrance | undefined> {
  return (await getFragrances()).find((f) => f.slug === slug);
}
