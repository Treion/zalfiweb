import { readListParams } from "@/components/admin/data-table/url-state";
import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { ORDER_FILTER_KEYS, ORDER_SORT_KEYS, listOrdersAdmin } from "@/server/orders/admin-query";

export const dynamic = "force-dynamic";

/** CSV of the orders for the current search and filters (customer details: audit-logged) */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("orders.view") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = readListParams(sp, {
    filterKeys: ORDER_FILTER_KEYS,
    sortKeys: ORDER_SORT_KEYS,
    defaultSort: "created",
  });
  const { rows } = await listOrdersAdmin({ ...p, page: 1, pageSize: 50_000 }, 50_000);
  const taka = (poisha: number) => (poisha / 100).toFixed(2);
  return csvResponse(
    "orders",
    [
      "order",
      "placed_utc",
      "status",
      "payment_status",
      "payment_method",
      "customer",
      "phone",
      "email",
      "street",
      "area",
      "district",
      "zone",
      "bottles",
      "subtotal_bdt",
      "discount_bdt",
      "shipping_bdt",
      "total_bdt",
      "coupon",
      "courier",
      "tracking",
    ],
    rows.map((o) => [
      o.number,
      o.createdAt,
      o.status,
      o.paymentStatus,
      o.paymentMethod,
      o.customerName,
      o.customerPhone,
      o.customerEmail,
      o.street,
      o.area,
      o.district,
      o.zone,
      o.bottles,
      taka(o.subtotal),
      taka(o.discount),
      taka(o.shippingFee),
      taka(o.total),
      o.couponCode,
      o.courier,
      o.trackingCode,
    ]),
    admin.actor,
    { q: p.q, ...p.filters },
  );
}
