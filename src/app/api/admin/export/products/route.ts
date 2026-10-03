import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { listProductsAdmin } from "@/server/catalog/products";

export const dynamic = "force-dynamic";

/** CSV of every size: fragrance, SKU, size, price, stock, held, status */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("products.manage") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const products = await listProductsAdmin();
  return csvResponse(
    "products",
    [
      "fragrance",
      "slug",
      "published",
      "sku",
      "size_ml",
      "price_taka",
      "stock",
      "held",
      "size_active",
    ],
    products.flatMap((f) =>
      f.variants.map((v) => [
        f.name,
        f.slug,
        f.published,
        v.sku,
        v.sizeMl,
        v.pricePoisha / 100,
        v.stock,
        v.reserved,
        v.active,
      ]),
    ),
    admin.actor,
  );
}
