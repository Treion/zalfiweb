import { readListParams } from "@/components/admin/data-table/url-state";
import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { listMovements } from "@/server/catalog/inventory";

export const dynamic = "force-dynamic";

/** CSV of the stock history for the current filters */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("inventory.manage") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = readListParams(sp, { filterKeys: ["type", "days", "variant"] });
  const { rows } = await listMovements({ ...p, page: 1, pageSize: 50_000 }, 50_000);
  return csvResponse(
    "stock-history",
    ["time_utc", "fragrance", "size_ml", "sku", "type", "change", "reason", "order", "by"],
    rows.map((r) => [
      r.createdAt,
      r.name,
      r.sizeMl,
      r.sku,
      r.type,
      r.delta,
      r.reason,
      r.orderNumber,
      r.by,
    ]),
    admin.actor,
    { q: p.q, ...p.filters },
  );
}
