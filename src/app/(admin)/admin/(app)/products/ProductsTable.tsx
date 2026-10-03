"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import { PackageIcon } from "lucide-react";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { Badge } from "@/components/admin/ui/badge";
import { formatPrice } from "@/lib/money";

type Row = {
  id: number;
  slug: string;
  name: string;
  tagline: string;
  published: boolean;
  bottleImage: string;
  palette: { bg: string; ink: string };
  variants: {
    id: number;
    sku: string;
    sizeMl: number;
    pricePoisha: number;
    stock: number;
    reserved: number;
    active: boolean;
  }[];
};

const meta = (m: ColumnMeta) => m;

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: "fragrance",
    header: "Fragrance",
    meta: meta({ label: "Fragrance" }),
    cell: ({ row: { original: f } }) => (
      <div className="flex items-center gap-3">
        <div
          className="relative size-11 shrink-0 overflow-hidden rounded-md border"
          style={{ background: f.palette.bg }}
        >
          <Image src={f.bottleImage} alt="" fill sizes="44px" className="object-contain p-0.5" />
        </div>
        <div className="min-w-0">
          <div className="font-display text-base leading-tight">{f.name}</div>
          <div className="text-muted-foreground max-w-xs truncate text-xs">{f.tagline}</div>
        </div>
      </div>
    ),
  },
  {
    id: "sizes",
    header: "Sizes and prices",
    meta: meta({ label: "Sizes and prices" }),
    cell: ({ row: { original: f } }) =>
      f.variants.length ? (
        <div className="flex flex-wrap gap-1.5">
          {f.variants.map((v) => (
            <Badge key={v.id} variant={v.active ? "outline" : "neutral"} className="tabular-nums">
              {v.sizeMl} ml · {formatPrice(v.pricePoisha)}
              {!v.active && " · off"}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">No sizes yet</span>
      ),
  },
  {
    id: "stock",
    header: "Stock",
    meta: meta({ label: "Stock" }),
    cell: ({ row: { original: f } }) => (
      <div className="flex flex-col gap-0.5 text-xs tabular-nums">
        {f.variants.map((v) => (
          <span
            key={v.id}
            className={v.stock - v.reserved <= 0 ? "text-[var(--tone-danger-fg)]" : undefined}
          >
            {v.sizeMl} ml: {v.stock}
            {v.reserved > 0 && <span className="text-muted-foreground"> ({v.reserved} held)</span>}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: meta({ label: "Status" }),
    cell: ({ row: { original: f } }) => (
      <Badge variant={f.published ? "success" : "neutral"}>
        {f.published ? "On the shop" : "Hidden"}
      </Badge>
    ),
  },
];

export function ProductsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      id="products"
      columns={columns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search name or SKU"
      filters={[
        {
          key: "status",
          label: "Statuses",
          options: [
            { value: "published", label: "On the shop" },
            { value: "hidden", label: "Hidden" },
          ],
        },
      ]}
      exportHref="/api/admin/export/products"
      getRowId={(r) => String(r.id)}
      rowHref={(r) => `/admin/products/${r.id}`}
      empty={
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-6">
          <PackageIcon className="size-5" />
          No fragrances match.
        </div>
      }
    />
  );
}
