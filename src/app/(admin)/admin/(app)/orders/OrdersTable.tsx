"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTransition } from "react";
import { PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { PaymentBadge, StatusBadge } from "@/components/admin/orders/badges";
import { Button } from "@/components/admin/ui/button";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import type { OrderListRow } from "@/server/orders/admin-query";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
} from "@/server/orders/state";
import { moveOrdersAction } from "./actions";

const meta = (m: ColumnMeta) => m;

const columns: ColumnDef<OrderListRow, unknown>[] = [
  {
    id: "number",
    header: "Order",
    enableHiding: false,
    meta: meta({ label: "Order", sortKey: "number" }),
    cell: ({ row: { original: o } }) => (
      <Link
        href={`/admin/orders/${o.id}`}
        className="font-medium tabular-nums underline-offset-4 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {o.number}
      </Link>
    ),
  },
  {
    id: "created",
    header: "Placed",
    meta: meta({ label: "Placed", sortKey: "created" }),
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "customer",
    header: "Customer",
    meta: meta({ label: "Customer" }),
    cell: ({ row: { original: o } }) => (
      <div className="leading-tight">
        <div>{o.customerName}</div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {formatPhone(o.customerPhone)}
        </div>
      </div>
    ),
  },
  {
    id: "area",
    header: "Delivers to",
    meta: meta({ label: "Delivers to" }),
    cell: ({ row: { original: o } }) => (
      <div className="leading-tight">
        <div>{o.area}</div>
        <div className="text-muted-foreground text-xs">
          {o.district} · {o.zone === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka"}
        </div>
      </div>
    ),
  },
  {
    id: "bottles",
    header: "Bottles",
    meta: meta({ label: "Bottles", className: "text-right" }),
    cell: ({ row }) => <span className="tabular-nums">{row.original.bottles}</span>,
  },
  {
    id: "total",
    header: "Total",
    meta: meta({ label: "Total", sortKey: "total", className: "text-right" }),
    cell: ({ row: { original: o } }) => (
      <div className="leading-tight">
        <div className="font-medium tabular-nums">{formatPrice(o.total)}</div>
        {o.couponCode && <div className="text-muted-foreground text-xs">{o.couponCode}</div>}
      </div>
    ),
  },
  {
    id: "payment",
    header: "Payment",
    meta: meta({ label: "Payment" }),
    cell: ({ row: { original: o } }) => (
      <PaymentBadge status={o.paymentStatus} cod={o.paymentMethod === "cod"} />
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: meta({ label: "Status" }),
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

export function OrdersTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const [pending, start] = useTransition();
  return (
    <DataTable
      id="orders"
      columns={columns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Order number, phone, name or email"
      getRowId={(o) => String(o.id)}
      rowHref={(o) => `/admin/orders/${o.id}`}
      defaultSort={{ key: "created", dir: "desc" }}
      exportHref="/api/admin/export/orders"
      filters={[
        {
          key: "status",
          label: "Statuses",
          options: ORDER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
        },
        {
          key: "payment",
          label: "Payments",
          options: PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] })),
        },
        {
          key: "method",
          label: "Methods",
          options: [
            { value: "sslcommerz", label: "Online" },
            { value: "cod", label: "Cash on delivery" },
          ],
        },
        {
          key: "zone",
          label: "Zones",
          options: [
            { value: "inside_dhaka", label: "Inside Dhaka" },
            { value: "outside_dhaka", label: "Outside Dhaka" },
          ],
        },
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
        { key: "coupon", label: "Coupons", options: [{ value: "any", label: "With a coupon" }] },
      ]}
      bulkActions={(selected, clear) => {
        const packable = selected.filter((o) => o.status === "confirmed");
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !packable.length}
            onClick={() =>
              start(async () => {
                const r = await moveOrdersAction({ ids: packable.map((o) => o.id), to: "packed" });
                if (!r.ok) return void toast.error(r.error);
                toast.success(
                  `${r.data.moved} ${r.data.moved === 1 ? "order" : "orders"} marked packed` +
                    (r.data.skipped.length ? `, ${r.data.skipped.length} skipped` : ""),
                );
                clear();
              })
            }
          >
            <PackageCheckIcon /> Mark packed
            {packable.length !== selected.length && ` (${packable.length})`}
          </Button>
        );
      }}
    />
  );
}
