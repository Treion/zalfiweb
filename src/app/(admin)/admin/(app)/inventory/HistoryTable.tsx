"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { HistoryIcon } from "lucide-react";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { Badge } from "@/components/admin/ui/badge";
import { formatDateTime } from "@/lib/time";
import { sizeLabel } from "@/lib/size";

type Row = {
  id: number;
  createdAt: Date;
  type: string;
  delta: number;
  reason: string | null;
  sku: string;
  sizeMl: number;
  pieces: number;
  name: string;
  orderId: number | null;
  orderNumber: string | null;
  by: string | null;
};
type Opt = { value: string; label: string };

const meta = (m: ColumnMeta) => m;
const TONE: Record<string, "success" | "info" | "neutral" | "warning" | "progress"> = {
  initial: "neutral",
  sale: "info",
  cancel_restock: "progress",
  return_restock: "progress",
  manual_adjustment: "warning",
};

export function HistoryTable({
  rows,
  total,
  page,
  pageSize,
  types,
  sizes,
}: {
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  types: Opt[];
  sizes: Opt[];
}) {
  const label = (t: string) => types.find((x) => x.value === t)?.label ?? t;
  const columns: ColumnDef<Row, unknown>[] = [
    {
      id: "time",
      header: "When",
      meta: meta({ label: "When", sortKey: "time" }),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
    {
      id: "size",
      header: "Size",
      meta: meta({ label: "Size" }),
      cell: ({ row: { original: r } }) => (
        <span>
          {r.name} <span className="text-muted-foreground">{sizeLabel(r.sizeMl, r.pieces)}</span>
        </span>
      ),
    },
    {
      id: "type",
      header: "Type",
      meta: meta({ label: "Type" }),
      cell: ({ row }) => (
        <Badge variant={TONE[row.original.type] ?? "neutral"}>{label(row.original.type)}</Badge>
      ),
    },
    {
      id: "change",
      header: "Change",
      meta: meta({ label: "Change", className: "text-right" }),
      cell: ({ row: { original: r } }) => (
        <span
          className={`font-medium tabular-nums ${r.delta > 0 ? "text-[var(--tone-success-fg)]" : "text-[var(--tone-danger-fg)]"}`}
        >
          {r.delta > 0 ? `+${r.delta}` : `−${Math.abs(r.delta)}`}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      meta: meta({ label: "Reason" }),
      cell: ({ row: { original: r } }) =>
        r.orderNumber ? (
          <Link
            href={`/admin/orders/${r.orderId}`}
            className="text-gold underline-offset-4 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {r.orderNumber}
          </Link>
        ) : (
          <span className="block max-w-xs truncate">{r.reason ?? "—"}</span>
        ),
    },
    {
      id: "by",
      header: "By",
      meta: meta({ label: "By" }),
      cell: ({ row }) => row.original.by ?? <span className="text-muted-foreground">system</span>,
    },
  ];
  return (
    <DataTable
      id="stock-history"
      columns={columns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Search size, SKU, reason or order"
      filters={[
        { key: "type", label: "Types", options: types },
        { key: "variant", label: "Sizes", options: sizes },
        {
          key: "days",
          label: "Dates",
          options: [
            { value: "1", label: "Last 24 hours" },
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ],
        },
      ]}
      exportHref="/api/admin/export/stock-movements"
      getRowId={(r) => String(r.id)}
      defaultSort={{ key: "time", dir: "desc" }}
      empty={
        <div className="text-muted-foreground flex flex-col items-center gap-2 py-6">
          <HistoryIcon className="size-5" />
          No stock changes match.
        </div>
      }
    />
  );
}
