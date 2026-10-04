import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import { BarList, ChartCard, SplitBar } from "@/components/admin/charts/parts";
import { RangePicker } from "@/components/admin/charts/RangePicker";
import { TimeChart } from "@/components/admin/charts/TimeChart";
import { formatCount, formatTaka } from "@/components/admin/charts/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/admin/ui/card";
import { cn } from "@/components/admin/lib/utils";
import { formatPrice } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { parseRange, rangeQuery, type Bucket } from "@/server/reports/range";
import {
  REPORT_KEYS,
  REPORT_LABELS,
  buildReport,
  forViewer,
  type Column,
  type ReportKey,
  type Row,
} from "@/server/reports/reports";

export const metadata = { title: "Reports" };

const GROUPS: { key: Bucket; label: string }[] = [
  { key: "day", label: "By day" },
  { key: "week", label: "By week" },
  { key: "month", label: "By month" },
];

function cell(v: Row[string], c: Column) {
  if (v === null || v === undefined || v === "") return "—";
  switch (c.kind) {
    case "count":
      return formatCount(Number(v));
    case "taka":
      return formatPrice(Number(v));
    case "percent": {
      const p = Number(v) * 100;
      return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
    }
    case "date":
      return v instanceof Date ? formatDateTime(v) : String(v);
    case "days":
      return `${Number(v).toLocaleString("en-IN")} ${Number(v) === 1 ? "day" : "days"}`;
    default:
      return String(v);
  }
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const admin = await requireAdmin("reports.view");
  const sp = await searchParams;
  const key: ReportKey = (REPORT_KEYS as readonly string[]).includes(String(sp.report))
    ? (sp.report as ReportKey)
    : "sales";
  const range = parseRange(sp, new Date(), "30d");
  const fallbackBy: Bucket = range.bucket === "hour" ? "day" : range.bucket;
  const by: Bucket = ["day", "week", "month"].includes(String(sp.by))
    ? (sp.by as Bucket)
    : fallbackBy;
  const money = admin.can("revenue.view");
  const report = forViewer(await buildReport(key, range, by), money);
  const grouped = key === "sales" || key === "refunds";
  const keep: Record<string, string> = { report: key, ...(grouped && sp.by ? { by } : {}) };
  const rq = rangeQuery(range);
  const exportHref = (part: string) =>
    `/api/admin/export/reports?report=${key}&part=${part}&${rq}${grouped ? `&by=${by}` : ""}`;
  const chart = report.chart;

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Every figure in Bangladesh time.${money ? "" : " Revenue figures are hidden for managers (Settings → Team)."}`}
      />
      <nav
        aria-label="Reports"
        className="bg-muted text-muted-foreground mb-4 inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg p-[3px] text-sm"
      >
        {REPORT_KEYS.map((k) => (
          <Link
            key={k}
            href={`/admin/reports?report=${k}&${rq}`}
            aria-current={key === k ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 font-medium whitespace-nowrap",
              key === k ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
            )}
          >
            {REPORT_LABELS[k]}
          </Link>
        ))}
      </nav>

      {report.timeless ? (
        <p className="text-muted-foreground mb-6 text-sm">
          As of now: stock doesn&apos;t look back.
        </p>
      ) : (
        <div className="flex flex-wrap items-start gap-x-4">
          <RangePicker range={range} basePath="/admin/reports" keep={keep} />
          {grouped && (
            <nav aria-label="Group by" className="mb-6 flex h-9 items-center gap-1 text-sm">
              {GROUPS.map((g) => (
                <Link
                  key={g.key}
                  href={`/admin/reports?report=${key}&${rq}&by=${g.key}`}
                  aria-current={by === g.key ? "true" : undefined}
                  className={cn(
                    "rounded-md px-2.5 py-1",
                    by === g.key
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {g.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      )}

      <p className="text-muted-foreground mb-6 max-w-3xl text-sm">{report.description}</p>

      {chart && chart.points.length > 0 && (
        <ChartCard
          className="mb-6"
          title={chart.title}
          description={report.timeless ? undefined : range.label}
        >
          {chart.kind === "time" ? (
            <TimeChart
              kind="bar"
              format={chart.money ? "taka" : "count"}
              name={chart.title}
              label={`${chart.title}, ${range.label}`}
              data={chart.points.map((p) => ({ label: p.label, value: p.value }))}
            />
          ) : chart.kind === "bars" ? (
            <BarList
              rows={chart.points.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.value,
                display: chart.money ? formatTaka(p.value) : formatCount(p.value),
              }))}
            />
          ) : (
            <SplitBar
              parts={chart.points.map((p) => ({
                key: p.key,
                label: p.label,
                value: p.value,
                display: formatCount(p.value),
              }))}
            />
          )}
        </ChartCard>
      )}

      <div className="flex flex-col gap-6">
        {report.tables.map(({ id, title, table }) => (
          <Card key={id} className="gap-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{title ?? report.title}</CardTitle>
                {admin.can("exports.csv") && (
                  <a
                    href={exportHref(id)}
                    className="border-input hover:bg-accent inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium"
                  >
                    <DownloadIcon aria-hidden className="size-3.5" /> CSV
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {table.rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{`${title ?? report.title}, ${report.timeless ? "now" : range.label}`}</caption>
                    <thead className="text-muted-foreground text-xs">
                      <tr>
                        {table.columns.map((c) => (
                          <th
                            key={c.key}
                            scope="col"
                            className={cn(
                              "pb-2 font-medium whitespace-nowrap",
                              c.kind === "text" || c.kind === "date"
                                ? "pr-4 text-left"
                                : "pl-4 text-right",
                            )}
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {table.rows.map((r, i) => (
                        <tr key={i}>
                          {table.columns.map((c) => (
                            <td
                              key={c.key}
                              className={cn(
                                "py-2",
                                c.kind === "text" || c.kind === "date"
                                  ? "max-w-xs truncate pr-4 text-left"
                                  : "pl-4 text-right tabular-nums",
                                c.kind === "date" && "text-muted-foreground whitespace-nowrap",
                              )}
                            >
                              {cell(r[c.key], c)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    {table.totals && (
                      <tfoot>
                        <tr className="border-t-2 font-medium">
                          {table.columns.map((c) => (
                            <td
                              key={c.key}
                              className={cn(
                                "pt-2",
                                c.kind === "text" || c.kind === "date"
                                  ? "pr-4 text-left"
                                  : "pl-4 text-right tabular-nums",
                              )}
                            >
                              {table.totals![c.key] == null ? "" : cell(table.totals![c.key], c)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nothing in this period.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
