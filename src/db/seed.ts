/**
 * Seeds the catalogue from src/db/seed-data.ts.
 *
 *   npm run db:seed          inserts anything missing (and fills empty scent profiles); never
 *                            overwrites your edits
 *   npm run db:seed -- --reset  overwrites fragrances, discovery sets, notes, prices and stock with
 *                            the seed values
 *
 * Uses node-postgres directly (scripts run in Node, not on the edge).
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { DISCOVERY_SETS, FRAGRANCES, NOTES } from "./seed-data";

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
                pricePoisha: v.pricePoisha,
                stock: v.stock,
                sizeMl: v.sizeMl,
              },
            })
          : q.onConflictDoNothing());
      }
    }

    // Discovery sets: added when missing, never overwritten (unless --reset)
    const fragranceIds = new Map(
      (
        await tx
          .select({ id: schema.fragrances.id, slug: schema.fragrances.slug })
          .from(schema.fragrances)
      ).map((r) => [r.slug, r.id]),
    );
    for (const s of DISCOVERY_SETS) {
      const values = {
        slug: s.slug,
        name: s.name,
        tagline: s.tagline,
        story: s.story,
        image: s.image,
        imageAlt: s.imageAlt,
        imageWidth: s.width,
        imageHeight: s.height,
        sortOrder: s.sortOrder,
      };
      const [created] = await (reset
        ? tx
            .insert(schema.discoverySets)
            .values(values)
            .onConflictDoUpdate({
              target: schema.discoverySets.slug,
              set: { ...values, updatedAt: sql`now()` },
            })
            .returning({ id: schema.discoverySets.id })
        : tx
            .insert(schema.discoverySets)
            .values(values)
            .onConflictDoNothing()
            .returning({ id: schema.discoverySets.id }));
      // An existing set keeps the owner's contents and pack
      if (!created) continue;
      await tx
        .delete(schema.discoverySetItems)
        .where(sql`${schema.discoverySetItems.setId} = ${created.id}`);
      await tx.insert(schema.discoverySetItems).values(
        s.fragrances.map((f, position) => ({
          setId: created.id,
          fragranceId: fragranceIds.get(f.slug)!,
          position,
        })),
      );
      const v = s.variant!;
      await tx
        .insert(schema.variants)
        .values({ ...v, setId: created.id })
        .onConflictDoUpdate({
          target: schema.variants.sku,
          set: { pricePoisha: v.pricePoisha, stock: v.stock, sizeMl: v.sizeMl, pieces: v.pieces },
        });
    }

    // Keep the stock ledger true: any stock the seed set (new sizes, or a --reset) gets a ledger row,
    // so variants.stock always equals the sum of its movements
    await tx.execute(sql`
      insert into stock_movements (variant_id, type, delta, reason)
      select v.id,
             (case when count(m.id) = 0 then 'initial' else 'manual_adjustment' end)::stock_movement_type,
             v.stock - coalesce(sum(m.delta), 0),
             ${reset ? "Seed reset" : "Opening stock"}
      from variants v left join stock_movements m on m.variant_id = v.id
      group by v.id
      having v.stock - coalesce(sum(m.delta), 0) <> 0`);
  });

  const counts = await db.execute(
    sql`select (select count(*) from fragrances) f, (select count(*) from notes) n, (select count(*) from fragrance_notes) fn, (select count(*) from variants) v, (select count(*) from discovery_sets) s`,
  );
  console.log(reset ? "Seeded (reset)" : "Seeded", counts.rows[0]);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
