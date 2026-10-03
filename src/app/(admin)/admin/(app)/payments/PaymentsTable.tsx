"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import {
  ATTEMPT_LABELS,
  AttemptBadge,
  REFUND_LABELS,
  RefundBadge,
  gatewayLabel,
} from "@/components/admin/orders/payment-badges";
import { formatPrice } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import type { PaymentListRow, RefundListRow } from "@/server/payments/admin-query";

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

const paymentColumns: ColumnDef<PaymentListRow, unknown>[] = [
  {
    id: "time",
    header: "When",
    meta: meta({ label: "When", sortKey: "time" }),
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
    cell: ({ row: { original: p } }) => orderLink(p.orderId, p.orderNumber),
  },
  {
    id: "customer",
    header: "Customer",
    meta: meta({ label: "Customer" }),
    cell: ({ row: { original: p } }) => (
      <div className="leading-tight">
        <div>{p.customerName}</div>
        <div className="text-muted-foreground text-xs tabular-nums">
          {formatPhone(p.customerPhone)}
        </div>
      </div>
    ),
  },
  {
    id: "tran",
    header: "Transaction",
    meta: meta({ label: "Transaction" }),
    cell: ({ row: { original: p } }) => (
      <div className="leading-tight">
        <div className="font-mono text-xs">{p.tranId}</div>
        <div className="text-muted-foreground text-xs">
          {[gatewayLabel(p.provider), p.method].filter(Boolean).join(" · ")}
        </div>
      </div>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    meta: meta({ label: "Amount", className: "text-right" }),
    cell: ({ row: { original: p } }) => (
      <div className="leading-tight">
        <div className="font-medium tabular-nums">{formatPrice(p.amount)}</div>
        {p.refunded > 0 && (
          <div className="text-muted-foreground text-xs tabular-nums">
            {`${formatPrice(-p.refunded)} refunded`}
          </div>
        )}
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: meta({ label: "Status" }),
    cell: ({ row }) => <AttemptBadge status={row.original.status} />,
  },
];

export function PaymentsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: PaymentListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      id="payments"
      columns={paymentColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Transaction, order, phone or method"
      getRowId={(p) => String(p.id)}
      rowHref={(p) => `/admin/orders/${p.orderId}`}
      defaultSort={{ key: "time", dir: "desc" }}
      exportHref="/api/admin/export/payments"
      filters={[
        {
          key: "status",
          label: "Statuses",
          options: [
            ...Object.entries(ATTEMPT_LABELS).map(([value, label]) => ({ value, label })),
            { value: "refunded", label: "With a refund" },
          ],
        },
        {
          key: "provider",
          label: "Gateways",
          options: [
            { value: "sslcommerz", label: "SSLCommerz" },
            { value: "mock", label: "Test gateway" },
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
      ]}
    />
  );
}

const refundColumns: ColumnDef<RefundListRow, unknown>[] = [
  {
    id: "time",
    header: "When",
    meta: meta({ label: "When" }),
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
    id: "amount",
    header: "Amount",
    meta: meta({ label: "Amount", className: "text-right" }),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{formatPrice(row.original.amount)}</span>
    ),
  },
  {
    id: "reason",
    header: "Reason",
    meta: meta({ label: "Reason" }),
    cell: ({ row: { original: r } }) => (
      <div className="max-w-xs leading-tight">
        <div className="truncate">{r.reason}</div>
        <div className="text-muted-foreground text-xs">
          {[r.manual ? "Paid back by hand" : "Through the provider", r.by]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    meta: meta({ label: "Status" }),
    cell: ({ row }) => <RefundBadge status={row.original.status} />,
  },
];

export function RefundsTable({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: RefundListRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return (
    <DataTable
      id="refunds"
      columns={refundColumns}
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      searchPlaceholder="Order or reason"
      getRowId={(r) => String(r.id)}
      rowHref={(r) => `/admin/orders/${r.orderId}`}
      empty={<span className="text-muted-foreground">No refunds yet.</span>}
      filters={[
        {
          key: "status",
          label: "Statuses",
          options: Object.entries(REFUND_LABELS).map(([value, label]) => ({ value, label })),
        },
        {
          key: "days",
          label: "Dates",
          options: [
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ],
        },
      ]}
    />
  );
}
