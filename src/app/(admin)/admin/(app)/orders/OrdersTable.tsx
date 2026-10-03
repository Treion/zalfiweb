"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useTransition } from "react";
import { ChevronDownIcon, PackageCheckIcon, PrinterIcon, TruckIcon } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { PaymentBadge, StatusBadge } from "@/components/admin/orders/badges";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
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
import type { CourierOption } from "@/server/shipping/couriers";
import { moveOrdersAction } from "./actions";
import { sendManyAction } from "../shipping/actions";

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
  couriers,
  defaultCourier,
  canShip,
}: {
  rows: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
  /** The couriers an admin can send with, the default first */
  couriers: CourierOption[];
  defaultCourier: string;
  canShip: boolean;
}) {
  const [pending, start] = useTransition();
  const sendWith = [...couriers].sort(
    (a, b) => Number(b.name === defaultCourier) - Number(a.name === defaultCourier),
  );
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
        const sendable = selected.filter(
          (o) => (o.status === "confirmed" || o.status === "packed") && !o.courier,
        );
        const labelled = selected.filter((o) => o.courier && o.trackingCode);
        const count = (n: number, all: number) => (n !== all ? ` (${n})` : "");
        return (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !packable.length}
              onClick={() =>
                start(async () => {
                  const r = await moveOrdersAction({
                    ids: packable.map((o) => o.id),
                    to: "packed",
                  });
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
              {count(packable.length, selected.length)}
            </Button>
            {canShip && sendWith.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={pending || !sendable.length}>
                    <TruckIcon /> Send to courier
                    {count(sendable.length, selected.length)} <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>Send with</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sendWith.map((c) => (
                    <DropdownMenuItem
                      key={c.name}
                      onSelect={() =>
                        start(async () => {
                          const r = await sendManyAction({
                            ids: sendable.map((o) => o.id),
                            courier: c.name,
                          });
                          if (!r.ok) return void toast.error(r.error);
                          const { sent, skipped } = r.data;
                          if (sent)
                            toast.success(
                              `${sent} ${sent === 1 ? "parcel" : "parcels"} sent with ${c.label}`,
                            );
                          for (const reason of skipped.slice(0, 3)) toast.error(reason);
                          if (skipped.length > 3)
                            toast.error(`${skipped.length - 3} more weren't sent.`);
                          clear();
                        })
                      }
                    >
                      {c.label}
                      {c.mode !== "live" ? ` (${c.mode})` : ""}
                      {c.name === defaultCourier ? (
                        <span className="text-muted-foreground ml-auto text-xs">Default</span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {labelled.length > 0 && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={`/api/admin/shipping/labels?ids=${labelled.map((o) => o.id).join(",")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <PrinterIcon /> Print labels{count(labelled.length, selected.length)}
                </a>
              </Button>
            )}
          </>
        );
      }}
    />
  );
}
