"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { PrinterIcon } from "lucide-react";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { StatusBadge } from "@/components/admin/orders/badges";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime, formatRelative } from "@/lib/time";
import { ORDER_STATUSES, STATUS_LABELS } from "@/server/orders/state";
import type { ReturnListRow, ShipmentListRow, ShippingView } from "@/server/shipping/admin-query";
import { RETURN_CONDITION_LABELS, type ReturnCondition } from "@/server/shipping/returns-meta";
import { mapStatus } from "@/server/shipping/status";
import { COURIER_LABELS } from "@/server/shipping/types";

const meta = (m: ColumnMeta) => m;

const orderLink = (id: number, number: string) => (
  <Link
    href={`/admin/orders/${id}`}
    className="font-medium tabular-nums underline-offset-4 hover:underline"
    onClick={(e) => e.stopPropagation()}
  >
    {number}
  </Link>
);

const DAYS = {
  key: "days",
  label: "Dates",
  options: [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
  ],
};

function shipmentColumns(view: ShippingView): ColumnDef<ShipmentListRow, unknown>[] {
  return [
    {
      id: "time",
      header: "Sent",
      meta: meta({ label: "Sent", sortKey: "time" }),
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDateTime(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "order",
      header: "Order",
      enableHiding: false,
      meta: meta({ label: "Order" }),
      cell: ({ row: { original: s } }) => orderLink(s.orderId, s.orderNumber),
    },
    {
      id: "customer",
      header: "Customer",
      meta: meta({ label: "Customer" }),
      cell: ({ row: { original: s } }) => (
        <div className="leading-tight">
          <div>{s.customerName}</div>
          <div className="text-muted-foreground text-xs tabular-nums">
            {`${formatPhone(s.customerPhone)} · ${s.district}`}
          </div>
        </div>
      ),
    },
    {
      id: "courier",
      header: "Courier",
      meta: meta({ label: "Courier" }),
      cell: ({ row: { original: s } }) => (
        <div className="leading-tight">
          <div>{COURIER_LABELS[s.courier]}</div>
          <div className="text-muted-foreground font-mono text-xs">{s.consignmentId ?? "—"}</div>
        </div>
      ),
    },
    {
      id: "news",
      header: "Courier says",
      meta: meta({ label: "Courier says" }),
      cell: ({ row: { original: s } }) => (
        <div className="leading-tight">
          <div>{mapStatus(s.courier, s.status).label}</div>
          <div className="text-muted-foreground text-xs">
            {s.lastCheckedAt ? formatRelative(s.lastCheckedAt) : "No news yet"}
          </div>
        </div>
      ),
    },
    {
      id: "cod",
      header: "Cash to collect",
      meta: meta({ label: "Cash to collect", className: "text-right" }),
      cell: ({ row: { original: s } }) => (
        <span className="tabular-nums">{s.codAmount ? formatPrice(s.codAmount) : "Paid"}</span>
      ),
    },
    ...(view === "failed"
      ? [
          {
            id: "attempts",
            header: "Attempts",
            meta: meta({ label: "Attempts", className: "text-right" }),
            cell: ({ row }) => <span className="tabular-nums">{row.original.attempts}</span>,
          } satisfies ColumnDef<ShipmentListRow, unknown>,
        ]
      : []),
    {
      id: "status",
      header: "Order status",
      meta: meta({ label: "Order status" }),
      cell: ({ row }) => <StatusBadge status={row.original.orderStatus} />,
    },
  ];
}

export function ShipmentsTable({
  view,
  rows,
  total,
  page,
  pageSize,
}: {
  view: ShippingView;
  rows: ShipmentListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      id={`shipments-${view}`}
      columns={shipmentColumns(view)}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Order, consignment, phone or name"
      getRowId={(s) => String(s.id)}
      rowHref={(s) => `/admin/orders/${s.orderId}`}
      defaultSort={{ key: "time", dir: "desc" }}
      filters={[
        {
          key: "courier",
          label: "Couriers",
          options: Object.entries(COURIER_LABELS).map(([value, label]) => ({ value, label })),
        },
        ...(view === "all"
          ? [
              {
                key: "status",
                label: "Order statuses",
                options: ORDER_STATUSES.filter((s) => s !== "pending_payment").map((s) => ({
                  value: s,
                  label: STATUS_LABELS[s],
                })),
              },
            ]
          : []),
        DAYS,
      ]}
      bulkActions={(selected) => (
        <Button size="sm" variant="outline" asChild>
          <a
            href={`/api/admin/shipping/labels?ids=${[...new Set(selected.map((s) => s.orderId))].join(",")}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <PrinterIcon /> Print labels
          </a>
        </Button>
      )}
    />
  );
}

const returnColumns: ColumnDef<ReturnListRow, unknown>[] = [
  {
    id: "time",
    header: "Back",
    meta: meta({ label: "Back" }),
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "order",
    header: "Order",
    enableHiding: false,
    meta: meta({ label: "Order" }),
    cell: ({ row: { original: r } }) => orderLink(r.orderId, r.orderNumber),
  },
  {
    id: "customer",
    header: "Customer",
    meta: meta({ label: "Customer" }),
    cell: ({ row }) => row.original.customerName,
  },
  {
    id: "bottles",
    header: "Bottles",
    meta: meta({ label: "Bottles", className: "text-right" }),
    cell: ({ row }) => <span className="tabular-nums">{row.original.bottles}</span>,
  },
  {
    id: "condition",
    header: "Condition",
    meta: meta({ label: "Condition" }),
    cell: ({ row: { original: r } }) => (
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{RETURN_CONDITION_LABELS[r.condition as ReturnCondition] ?? r.condition}</span>
        <Badge variant={r.restocked ? "success" : "neutral"}>
          {r.restocked ? "Back in stock" : "Not restocked"}
        </Badge>
      </div>
    ),
  },
  {
    id: "reason",
    header: "Why",
    meta: meta({ label: "Why" }),
    cell: ({ row: { original: r } }) => (
      <div className="max-w-xs leading-tight">
        <div className="truncate">{r.reason}</div>
        {r.adminName && <div className="text-muted-foreground text-xs">{r.adminName}</div>}
      </div>
    ),
  },
];

export function ReturnsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: ReturnListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      id="returns"
      columns={returnColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Order, name or reason"
      getRowId={(r) => String(r.id)}
      rowHref={(r) => `/admin/orders/${r.orderId}`}
      filters={[DAYS]}
    />
  );
}
