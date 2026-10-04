import { readListParams } from "@/components/admin/data-table/url-state";
import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import {
  CUSTOMER_FILTER_KEYS,
  CUSTOMER_SORT_KEYS,
  listCustomersAdmin,
} from "@/server/customers/admin-query";

export const dynamic = "force-dynamic";

/** CSV of the customers for the current search and filters (audit-logged: personal data) */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("customers.view") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = readListParams(sp, {
    filterKeys: CUSTOMER_FILTER_KEYS,
    sortKeys: CUSTOMER_SORT_KEYS,
    defaultSort: "last",
  });
  const money = admin.can("revenue.view");
  const { rows } = await listCustomersAdmin({ ...p, page: 1, pageSize: 50_000 }, 50_000);
  return csvResponse(
    "customers",
    [
      "name",
      "phone",
      "email",
      "district",
      "orders",
      "orders_placed",
      ...(money ? ["spent_bdt"] : []),
      "first_order_utc",
      "last_order_utc",
    ],
    rows.map((c) => [
      c.name,
      c.phone,
      c.email,
      c.district,
      c.orders,
      c.placed,
      ...(money ? [(c.spent / 100).toFixed(2)] : []),
      c.firstAt,
      c.lastAt,
    ]),
    admin.actor,
    { q: p.q, filters: p.filters },
  );
}
