import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { variants } from "@/db/schema";
import { FRAGRANCES } from "@/db/seed-data";

// Edge-portable (see api/newsletter/route.ts). Live stock for the cart and product pages.

export async function GET(req: Request) {
  const skus = (new URL(req.url).searchParams.get("skus") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!skus.length) return Response.json({ stock: {} });

  const db = getDb();
  let rows: { sku: string; stock: number; priceCents: number }[];
  if (db) {
    try {
      rows = await db
        .select({ sku: variants.sku, stock: variants.stock, priceCents: variants.priceCents })
        .from(variants)
        .where(inArray(variants.sku, skus));
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
        rows.map((r) => [r.sku, { stock: r.stock, priceCents: r.priceCents }]),
      ),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
