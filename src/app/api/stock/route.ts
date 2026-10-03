import { and, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { fragrances, stockReservations, variants } from "@/db/schema";
import { FRAGRANCES } from "@/db/seed-data";

// Edge-portable (see api/newsletter/route.ts). Live stock for the bag and product pages.
// `stock` is what can be bought now: stock minus bottles held for unpaid orders. Sizes that are
// switched off, or belong to a hidden fragrance, aren't sold and don't appear.

export async function GET(req: Request) {
  const skus = (new URL(req.url).searchParams.get("skus") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!skus.length) return Response.json({ stock: {} });

  const db = getDb();
  let rows: { sku: string; stock: number; pricePoisha: number }[];
  if (db) {
    try {
      const held = db
        .select({
          variantId: stockReservations.variantId,
          qty: sql<number>`sum(${stockReservations.qty})`.as("qty"),
        })
        .from(stockReservations)
        .where(
          and(isNull(stockReservations.releasedAt), gt(stockReservations.expiresAt, sql`now()`)),
        )
        .groupBy(stockReservations.variantId)
        .as("held");
      rows = await db
        .select({
          sku: variants.sku,
          stock: sql<number>`greatest(0, ${variants.stock} - coalesce(${held.qty}, 0))::int`,
          pricePoisha: variants.pricePoisha,
        })
        .from(variants)
        .innerJoin(fragrances, eq(fragrances.id, variants.fragranceId))
        .leftJoin(held, eq(held.variantId, variants.id))
        .where(
          and(
            inArray(variants.sku, skus),
            eq(variants.active, true),
            eq(fragrances.published, true),
          ),
        );
    } catch (err) {
      console.error("[stock]", (err as Error).message);
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
  } else {
    rows = FRAGRANCES.flatMap((f) => f.variants).filter((v) => skus.includes(v.sku));
  }

  return Response.json(
    {
      stock: Object.fromEntries(
        rows.map((r) => [r.sku, { stock: Number(r.stock), pricePoisha: r.pricePoisha }]),
      ),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
