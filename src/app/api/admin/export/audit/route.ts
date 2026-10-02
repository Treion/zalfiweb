import { readListParams } from "@/components/admin/data-table/url-state";
import { AUDIT_AREAS, listAudit } from "@/server/admin/audit-query";
import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

/** CSV of the activity log for the current search/filter (owner only; the export itself is logged) */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("audit.view") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const p = readListParams(sp, { filterKeys: ["area"] });
  const valid = AUDIT_AREAS.some((a) => a.value === p.filters.area);
  if (!valid) delete p.filters.area;
  const { rows } = await listAudit({ ...p, page: 1, pageSize: 10_000 }, 10_000);
  return csvResponse(
    "activity",
    ["time_utc", "who", "action", "entity", "entity_id", "ip", "before", "after"],
    rows.map((r) => [
      r.createdAt,
      r.actorEmail,
      r.action,
      r.entity,
      r.entityId,
      r.ip,
      r.before,
      r.after,
    ]),
    admin.actor,
    { q: p.q, ...p.filters },
  );
}
