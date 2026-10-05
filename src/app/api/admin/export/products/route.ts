import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { listProductsAdmin } from "@/server/catalog/products";
import { listSetsAdmin } from "@/server/catalog/sets";

export const dynamic = "force-dynamic";

/** CSV of every size, then every discovery set's pack: name, SKU, size, price, stock, held, status */
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("products.manage") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const [products, sets] = await Promise.all([listProductsAdmin(), listSetsAdmin()]);
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
      "pieces",
    ],
    products
      .flatMap((f) =>
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
          1,
        ]),
      )
      .concat(
        sets.flatMap((st) =>
          st.pack
            ? [
                [
                  st.name,
                  st.slug,
                  st.published,
                  st.pack.sku,
                  st.pack.sizeMl,
                  st.pack.pricePoisha / 100,
                  st.pack.stock,
                  st.pack.stock - st.pack.available,
                  st.pack.active,
                  st.pack.pieces,
                ],
              ]
            : [],
        ),
      ),
    admin.actor,
  );
}
