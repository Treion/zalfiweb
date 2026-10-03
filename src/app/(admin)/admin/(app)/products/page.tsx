import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { readListParams } from "@/components/admin/data-table/url-state";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { Button } from "@/components/admin/ui/button";
import { requireAdmin } from "@/server/auth/session";
import { listProductsAdmin } from "@/server/catalog/products";
import { ProductsTable } from "./ProductsTable";

export const metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin("products.manage");
  const p = readListParams(await searchParams, { filterKeys: ["status"], pageSize: 25 });
  const all = await listProductsAdmin();
  const q = p.q.toLowerCase();
  const rows = all.filter(
    (f) =>
      (!q ||
        f.name.toLowerCase().includes(q) ||
        f.slug.includes(q) ||
        f.variants.some((v) => v.sku.toLowerCase().includes(q))) &&
      (!p.filters.status || (p.filters.status === "published" ? f.published : !f.published)),
  );
  const page = rows.slice((p.page - 1) * p.pageSize, p.page * p.pageSize);
  return (
    <>
      <PageHeader
        title="Products"
        description="Fragrances, their sizes and prices. Changes show on the shop straight away."
        actions={
          <Button asChild>
            <Link href="/admin/products/new">
              <PlusIcon /> New fragrance
            </Link>
          </Button>
        }
      />
      <ProductsTable rows={page} total={rows.length} page={p.page} pageSize={p.pageSize} />
    </>
  );
}
