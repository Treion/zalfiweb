import { csvResponse } from "@/server/admin/csv";
import { getAdmin } from "@/server/auth/session";
import { parseRange, type Bucket } from "@/server/reports/range";
import {
  REPORT_KEYS,
  buildReport,
  csvValue,
  forViewer,
  type ReportKey,
} from "@/server/reports/reports";

export const dynamic = "force-dynamic";

/**
 * CSV of one report table: ?report=sales&part=sales&range=30d&by=week. Money columns follow the
 * "managers can see revenue" toggle. Taka columns carry _bdt, shares _pct.
 */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return new Response("Sign in", { status: 401 });
  if (!admin.can("reports.view") || !admin.can("exports.csv"))
    return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  if (!(REPORT_KEYS as readonly string[]).includes(sp.report ?? ""))
    return new Response("Unknown report", { status: 404 });
  const key = sp.report as ReportKey;
  const range = parseRange(sp, new Date(), "30d");
  const by: Bucket = ["day", "week", "month"].includes(sp.by ?? "")
    ? (sp.by as Bucket)
    : range.bucket === "hour"
      ? "day"
      : range.bucket;
  const report = forViewer(await buildReport(key, range, by), admin.can("revenue.view"));
  const part = report.tables.find((t) => t.id === (sp.part ?? key)) ?? report.tables[0]!;
  const { columns, rows, totals } = part.table;
  const header = columns.map((c) =>
    c.kind === "taka"
      ? `${c.key}_bdt`
      : c.kind === "percent"
        ? `${c.key}_pct`
        : c.kind === "date"
          ? `${c.key}_utc`
          : c.key,
  );
  const data = [...rows, ...(totals ? [totals] : [])].map((r) =>
    columns.map((c) => csvValue(r[c.key], c.kind)),
  );
  return csvResponse(`report-${part.id}`, header, data, admin.actor, {
    report: key,
    from: range.fromDay,
    to: range.toDay,
    by,
  });
}
