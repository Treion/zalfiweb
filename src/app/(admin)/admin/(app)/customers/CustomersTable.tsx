"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/time";
import type { CustomerListRow } from "@/server/customers/admin-query";

const meta = (m: ColumnMeta) => m;

function columns(money: boolean): ColumnDef<CustomerListRow, unknown>[] {
  return [
    {
      id: "name",
      header: "Customer",
      enableHiding: false,
      meta: meta({ label: "Customer", sortKey: "name" }),
      cell: ({ row: { original: c } }) => (
        <div className="leading-tight">
          <Link
            href={`/admin/customers/${c.id}`}
            className="font-medium underline-offset-4 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.name}
          </Link>
          <div className="text-muted-foreground text-xs tabular-nums">{formatPhone(c.phone)}</div>
        </div>
      ),
    },
    {
      id: "email",
      header: "Email",
      meta: meta({ label: "Email" }),
      cell: ({ row }) => (
        <span className="text-muted-foreground break-all">{row.original.email ?? "—"}</span>
      ),
    },
    {
      id: "district",
      header: "District",
      meta: meta({ label: "District" }),
      cell: ({ row }) => row.original.district ?? "—",
    },
    {
      id: "orders",
      header: "Orders",
      meta: meta({ label: "Orders", sortKey: "orders", className: "text-right" }),
      cell: ({ row: { original: c } }) => (
        <span className="tabular-nums">
          {c.orders}
          {c.placed > c.orders && (
            <span className="text-muted-foreground text-xs"> {`of ${c.placed}`}</span>
          )}
        </span>
      ),
    },
    ...(money
      ? [
          {
            id: "spent",
            header: "Spent",
            meta: meta({ label: "Spent", sortKey: "spent", className: "text-right" }),
            cell: ({ row }) => (
              <span className="font-medium tabular-nums">{formatPrice(row.original.spent)}</span>
            ),
          } satisfies ColumnDef<CustomerListRow, unknown>,
        ]
      : []),
    {
      id: "last",
      header: "Last order",
      meta: meta({ label: "Last order", sortKey: "last" }),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.lastAt ? formatDate(row.original.lastAt) : "—"}
        </span>
      ),
    },
    {
      id: "joined",
      header: "First seen",
      meta: meta({ label: "First seen", sortKey: "joined" }),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(row.original.firstAt ?? row.original.joinedAt)}
        </span>
      ),
    },
  ];
}

export function CustomersTable({
  rows,
  total,
  page,
  pageSize,
  money,
  canExport,
}: {
  rows: CustomerListRow[];
  total: number;
  page: number;
  pageSize: number;
  money: boolean;
  canExport: boolean;
}) {
  return (
    <DataTable
      id="customers"
      columns={columns(money)}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Name, phone or email"
      getRowId={(c) => String(c.id)}
      rowHref={(c) => `/admin/customers/${c.id}`}
      defaultSort={{ key: "last", dir: "desc" }}
      exportHref={canExport ? "/api/admin/export/customers" : undefined}
      filters={[
        {
          key: "kind",
          label: "Customers",
          options: [
            { value: "repeat", label: "Came back (2+ orders)" },
            { value: "new", label: "One order" },
            { value: "none", label: "No sale yet" },
          ],
        },
        {
          key: "days",
          label: "Dates",
          options: [
            { value: "7", label: "Ordered in the last 7 days" },
            { value: "30", label: "Ordered in the last 30 days" },
            { value: "90", label: "Ordered in the last 90 days" },
          ],
        },
      ]}
    />
  );
}
