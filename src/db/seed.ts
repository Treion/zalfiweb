/**
 * Seeds the catalogue from src/db/seed-data.ts.
 *
 *   npm run db:seed          inserts anything missing (and fills empty scent profiles); never
 *                            overwrites your edits
 *   npm run db:seed -- --reset  overwrites fragrances, notes, prices and stock with the seed values
 *
 * Uses node-postgres directly (scripts run in Node, not on the edge).
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { FRAGRANCES, NOTES } from "./seed-data";

const reset = process.argv.includes("--reset");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  const pool = new pg.Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  await db.transaction(async (tx) => {
    for (const n of NOTES) {
      const q = tx.insert(schema.notes).values(n);
      await (reset
        ? q.onConflictDoUpdate({
            target: schema.notes.slug,
            set: { name: n.name, image: n.image, alt: n.alt },
          })
        : q.onConflictDoNothing());
    }
    const noteIds = new Map(
      (await tx.select({ id: schema.notes.id, slug: schema.notes.slug }).from(schema.notes)).map(
        (r) => [r.slug, r.id],
      ),
    );

    for (const f of FRAGRANCES) {
      const values = {
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
        profile: f.profile,
      };
      const q = tx.insert(schema.fragrances).values(values);
      await (reset
        ? q.onConflictDoUpdate({
            target: schema.fragrances.slug,
            set: { ...values, updatedAt: sql`now()` },
          })
        : // Never touches the owner's edits: only fills a scent profile that is still empty
          q.onConflictDoUpdate({
            target: schema.fragrances.slug,
            set: { profile: sql`coalesce(${schema.fragrances.profile}, excluded.profile)` },
          }));
      const [{ id }] = await tx
        .select({ id: schema.fragrances.id })
        .from(schema.fragrances)
        .where(sql`${schema.fragrances.slug} = ${f.slug}`);

      if (reset)
        await tx
          .delete(schema.fragranceNotes)
          .where(sql`${schema.fragranceNotes.fragranceId} = ${id}`);
      for (const n of f.notes) {
        await tx
          .insert(schema.fragranceNotes)
          .values({
            fragranceId: id,
            noteId: noteIds.get(n.slug)!,
            layer: n.layer,
            label: n.label,
            position: n.position,
          })
          .onConflictDoNothing();
      }
      for (const v of f.variants) {
        const q = tx.insert(schema.variants).values({ ...v, fragranceId: id });
        await (reset
          ? q.onConflictDoUpdate({
              target: schema.variants.sku,
              set: {
                priceCents: v.priceCents,
                stock: v.stock,
                currency: v.currency,
                sizeMl: v.sizeMl,
              },
            })
          : q.onConflictDoNothing());
      }
    }
  });

  const counts = await db.execute(
    sql`select (select count(*) from fragrances) f, (select count(*) from notes) n, (select count(*) from fragrance_notes) fn, (select count(*) from variants) v`,
  );
  console.log(reset ? "Seeded (reset)" : "Seeded", counts.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
