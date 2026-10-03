"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { DataTable, type ColumnMeta } from "@/components/admin/data-table/DataTable";
import { Badge } from "@/components/admin/ui/badge";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { CouponListRow } from "@/server/coupons";
import { COUPON_STATES, describeCoupon } from "@/components/admin/coupons/labels";

const meta = (m: ColumnMeta) => m;

export function CouponsTable({
  rows,
  showRevenue,
}: {
  rows: CouponListRow[];
  showRevenue: boolean;
}) {
  const columns: ColumnDef<CouponListRow, unknown>[] = [
    {
      id: "code",
      header: "Code",
      enableHiding: false,
      meta: meta({ label: "Code" }),
      cell: ({ row: { original: c } }) => (
        <div className="leading-tight">
          <Link
            href={`/admin/coupons/${c.id}`}
            className="font-mono font-medium underline-offset-4 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.code}
          </Link>
          {c.description && (
            <div className="text-muted-foreground max-w-56 truncate text-xs">{c.description}</div>
          )}
        </div>
      ),
    },
    {
      id: "offer",
      header: "Offer",
      meta: meta({ label: "Offer" }),
      cell: ({ row: { original: c } }) => (
        <div className="leading-tight">
          <div>{describeCoupon(c)}</div>
          <div className="text-muted-foreground text-xs">
            {[
              c.minSubtotal !== null && `from ${formatPrice(c.minSubtotal)}`,
              c.firstOrderOnly && "first order",
              (c.fragranceIds.length > 0 || c.variantIds.length > 0) && "some fragrances",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      ),
    },
    {
      id: "state",
      header: "Status",
      meta: meta({ label: "Status" }),
      cell: ({ row: { original: c } }) => (
        <Badge variant={COUPON_STATES[c.state].tone}>{COUPON_STATES[c.state].label}</Badge>
      ),
    },
    {
      id: "uses",
      header: "Uses",
      meta: meta({ label: "Uses", className: "text-right" }),
      cell: ({ row: { original: c } }) => (
        <span className="tabular-nums">
          {c.uses}
          {c.usageLimit !== null && (
            <span className="text-muted-foreground"> / {c.usageLimit}</span>
          )}
        </span>
      ),
    },
    ...(showRevenue
      ? ([
          {
            id: "revenue",
            header: "Revenue",
            meta: meta({ label: "Revenue", className: "text-right" }),
            cell: ({ row }) => (
              <span className="tabular-nums">{formatPrice(row.original.revenue)}</span>
            ),
          },
          {
            id: "discount",
            header: "Discount given",
            meta: meta({ label: "Discount given", className: "text-right" }),
            cell: ({ row }) => (
              <span className="tabular-nums">{formatPrice(row.original.discountGiven)}</span>
            ),
          },
        ] satisfies ColumnDef<CouponListRow, unknown>[])
      : []),
    {
      id: "dates",
      header: "Runs",
      meta: meta({ label: "Runs" }),
      cell: ({ row: { original: c } }) => (
        <span className="text-muted-foreground text-xs">
          {c.startsAt || c.endsAt
            ? `${c.startsAt ? formatDate(c.startsAt) : "Now"} – ${c.endsAt ? formatDate(c.endsAt) : "no end"}`
            : "Always"}
        </span>
      ),
    },
  ];
  return (
    <DataTable
      id="coupons"
      columns={columns}
      rows={rows}
      total={rows.length}
      page={1}
      pageSize={Math.max(rows.length, 1)}
      searchPlaceholder="Search codes"
      getRowId={(c) => String(c.id)}
      rowHref={(c) => `/admin/coupons/${c.id}`}
      filters={[
        {
          key: "state",
          label: "Statuses",
          options: Object.entries(COUPON_STATES).map(([value, s]) => ({ value, label: s.label })),
        },
      ]}
    />
  );
}
