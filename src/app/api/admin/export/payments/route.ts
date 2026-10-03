import { readListParams } from "@/components/admin/data-table/url-state";
import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { PAYMENT_FILTER_KEYS, listPaymentsAdmin } from "@/server/payments/admin-query";

export const dynamic = "force-dynamic";

/** CSV of the payment attempts for the current search and filters (audit-logged) */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("payments.view") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = readListParams(sp, { filterKeys: PAYMENT_FILTER_KEYS });
  const { rows } = await listPaymentsAdmin({ ...p, page: 1, pageSize: 50_000 }, 50_000);
  const taka = (poisha: number) => (poisha / 100).toFixed(2);
  return csvResponse(
    "payments",
    [
      "time_utc",
      "order",
      "customer",
      "phone",
      "gateway",
      "transaction",
      "method",
      "status",
      "amount_bdt",
      "refunded_bdt",
    ],
    rows.map((r) => [
      r.createdAt,
      r.orderNumber,
      r.customerName,
      r.customerPhone,
      r.provider,
      r.tranId,
      r.method,
      r.status,
      taka(r.amount),
      taka(r.refunded),
    ]),
    admin.actor,
    { q: p.q, ...p.filters },
  );
}
