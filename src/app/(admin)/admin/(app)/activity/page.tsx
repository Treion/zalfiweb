import { PageHeader } from "@/components/admin/shell/PageHeader";
import { readListParams } from "@/components/admin/data-table/url-state";
import { AUDIT_AREAS, listAudit } from "@/server/admin/audit-query";
import { requireAdmin } from "@/server/auth/session";
import { ActivityTable } from "./ActivityTable";

export const metadata = { title: "Activity log" };

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin("audit.view");
  const p = readListParams(await searchParams, { filterKeys: ["area"], pageSize: 50 });
  if (p.filters.area && !AUDIT_AREAS.some((a) => a.value === p.filters.area)) delete p.filters.area;
  const { rows, total } = await listAudit(p);
  return (
    <>
      <PageHeader
        title="Activity log"
        description="Every important change in the admin: who did it, when, and what it was before and after."
      />
      <ActivityTable
        rows={rows}
        total={total}
        page={p.page}
        pageSize={p.pageSize}
        areas={AUDIT_AREAS}
      />
    </>
  );
}
