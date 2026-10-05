import Link from "next/link";
import {
  AlertTriangleIcon,
  BanknoteIcon,
  CircleSlashIcon,
  ClockIcon,
  PackageXIcon,
  PlugZapIcon,
  SmartphoneIcon,
  Undo2Icon,
} from "lucide-react";
import { PageHeader } from "@/components/admin/shell/PageHeader";
import {
  ChartCard,
  BarList,
  RankTable,
  SplitBar,
  StatTile,
  type TableView,
} from "@/components/admin/charts/parts";
import { RangePicker } from "@/components/admin/charts/RangePicker";
import { TimeChart } from "@/components/admin/charts/TimeChart";
import { delta, formatCount, formatTaka, percent } from "@/components/admin/charts/format";
import { formatPrice } from "@/lib/money";
import { formatRelative } from "@/lib/time";
import { requireAdmin } from "@/server/auth/session";
import { STATUS_LABELS } from "@/server/orders/state";
import {
  attention,
  byFragrance,
  byMethod,
  bySize,
  byStatus,
  byZone,
  glance,
  series,
  totals,
  type Attention,
} from "@/server/reports/metrics";
import { parseRange, rangeQuery } from "@/server/reports/range";

export const metadata = { title: "Overview" };

const ATTENTION: Record<Attention["kind"], { label: string; icon: typeof ClockIcon }> = {
  integration: { label: "Integration failing", icon: PlugZapIcon },
  manual_payment: { label: "Check payment", icon: SmartphoneIcon },
  expiring: { label: "Lapsing soon", icon: ClockIcon },
  payment_failed: { label: "Payment failed", icon: BanknoteIcon },
  delivery_failed: { label: "Delivery failed", icon: AlertTriangleIcon },
  return_requested: { label: "Return asked", icon: Undo2Icon },
  out_of_stock: { label: "Sold out", icon: PackageXIcon },
};

function greeting(now: Date) {
  const h = (now.getUTCHours() + 6) % 24;
  return h < 5
    ? "Good evening"
    : h < 12
      ? "Good morning"
      : h < 17
        ? "Good afternoon"
        : "Good evening";
}

export default async function OverviewPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireAdmin("dashboard.view");
  const sp = await searchParams;
  const now = new Date();
  const range = parseRange(sp, now, "30d");
  const compare = sp.compare === "1";
  const money = admin.can("revenue.view");
  const { from, to } = range;

  const [g, sum, prevSum, points, statuses, fragrances, sizes, methods, zones, issues] =
    await Promise.all([
      glance(now),
      totals(from, to),
      totals(range.prev.from, range.prev.to),
      series(range),
      byStatus(from, to),
      byFragrance(from, to),
      bySize(from, to),
      byMethod(from, to),
      byZone(from, to),
      attention(now),
    ]);

  const vsYesterday = (v: number, f: (n: number) => string) => `vs ${f(v)} this time yesterday`;
  const today = [
    ...(money
      ? [
          {
            label: "Revenue today",
            value: formatTaka(g.revenue.now),
            delta: delta(g.revenue.now, g.revenue.then, { upIsGood: true }),
            compare: vsYesterday(g.revenue.then, formatTaka),
          },
        ]
      : []),
    {
      label: "Orders today",
      value: formatCount(g.orders.now),
      delta: delta(g.orders.now, g.orders.then, { upIsGood: true, units: true }),
      compare: vsYesterday(g.orders.then, formatCount),
      href: "/admin/orders",
    },
    {
      label: "To pack",
      value: formatCount(g.toPack.now),
      delta: delta(g.toPack.now, g.toPack.then, { upIsGood: false, units: true }),
      compare: vsYesterday(g.toPack.then, formatCount),
      href: "/admin/orders?view=to_pack",
    },
    {
      label: "To send to a courier",
      value: formatCount(g.toSend.now),
      delta: delta(g.toSend.now, g.toSend.then, { upIsGood: false, units: true }),
      compare: vsYesterday(g.toSend.then, formatCount),
      href: "/admin/orders?view=to_ship",
    },
    {
      label: "Low or sold out",
      value: formatCount(g.lowStock.now),
      delta: delta(g.lowStock.now, g.lowStock.then, { upIsGood: false, units: true }),
      compare: vsYesterday(g.lowStock.then, formatCount),
      href: "/admin/inventory",
    },
    {
      label: "Failed deliveries",
      value: formatCount(g.failed.now),
      delta: delta(g.failed.now, g.failed.then, { upIsGood: false, units: true }),
      compare: vsYesterday(g.failed.then, formatCount),
      href: "/admin/shipping?view=failed",
    },
  ];

  const vsPrev = `vs ${range.prev.label}`;
  const period = [
    ...(money
      ? [
          {
            label: "Revenue",
            value: formatTaka(sum.revenue),
            delta: delta(sum.revenue, prevSum.revenue, { upIsGood: true }),
          },
        ]
      : []),
    {
      label: "Orders",
      value: formatCount(sum.orders),
      delta: delta(sum.orders, prevSum.orders, { upIsGood: true }),
    },
    ...(money
      ? [
          {
            label: "Average order",
            value: formatTaka(sum.aov),
            delta: delta(sum.aov, prevSum.aov, { upIsGood: true }),
          },
        ]
      : []),
    {
      label: "Bottles sold",
      value: formatCount(sum.bottles),
      delta: delta(sum.bottles, prevSum.bottles, { upIsGood: true }),
    },
  ];

  const prevName = compare ? range.prev.label : undefined;
  const seriesTable = (
    key: "revenue" | "orders" | "aov",
    fmt: (n: number) => string,
  ): TableView => ({
    columns: [
      range.bucket === "hour"
        ? "Hour"
        : range.bucket === "day"
          ? "Day"
          : range.bucket === "week"
            ? "Week"
            : "Month",
      key === "revenue" ? "Revenue" : key === "orders" ? "Orders" : "Average order",
      ...(compare && key !== "aov" ? ["Previous period"] : []),
    ],
    rows: points.map((p) => [
      p.label,
      p[key] == null ? "No orders" : fmt(p[key]!),
      ...(compare && key !== "aov"
        ? [
            p[key === "revenue" ? "prevRevenue" : "prevOrders"] == null
              ? "—"
              : fmt(p[key === "revenue" ? "prevRevenue" : "prevOrders"]!),
          ]
        : []),
    ]),
  });
  const statusTotal = statuses.reduce((n, s) => n + s.orders, 0);
  const fragTotal = fragrances.reduce((n, f) => n + (money ? f.revenue : f.bottles), 0);
  const rq = rangeQuery(range);
  const top = fragrances.slice(0, 10);

  return (
    <>
      <PageHeader
        title={`${greeting(now)}, ${admin.user.name.split(" ")[0]}`}
        description="Today at a glance, then the period you choose."
      />

      <section aria-labelledby="today" className="mb-8">
        <h2 id="today" className="eyebrow mb-3">
          Today so far
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
          {today.map((t) => (
            <StatTile key={t.label} {...t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="period">
        <h2 id="period" className="eyebrow mb-3">
          {range.label}
        </h2>
        <RangePicker range={range} basePath="/admin" compare={compare} />
        <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {period.map((t) => (
            <StatTile key={t.label} {...t} compare={vsPrev} />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {money ? (
            <ChartCard
              className="xl:col-span-2"
              title="Revenue"
              description="Orders placed, less refunds. Unpaid, cancelled and returned orders don't count."
              table={seriesTable("revenue", formatPrice)}
            >
              <TimeChart
                kind="area"
                format="taka"
                name="Revenue"
                prevName={prevName}
                label={`Revenue over ${range.label}`}
                data={points.map((p) => ({
                  label: p.label,
                  value: p.revenue,
                  prev: p.prevRevenue,
                }))}
              />
            </ChartCard>
          ) : (
            <ChartCard
              className="xl:col-span-2"
              title="Orders"
              description="Revenue figures are hidden for managers (Settings → Team)."
              table={seriesTable("orders", formatCount)}
            >
              <TimeChart
                kind="bar"
                format="count"
                name="Orders"
                prevName={prevName}
                label={`Orders over ${range.label}`}
                data={points.map((p) => ({ label: p.label, value: p.orders, prev: p.prevOrders }))}
              />
            </ChartCard>
          )}

          <ChartCard
            title="Needs attention"
            description={issues.length ? `${issues.length} to look at` : undefined}
          >
            {issues.length ? (
              <ul className="-mx-2 flex max-h-[19rem] flex-col overflow-y-auto">
                {issues.map((i) => {
                  const A = ATTENTION[i.kind];
                  return (
                    <li key={`${i.kind}-${i.href}-${i.title}`}>
                      <Link
                        href={i.href}
                        className="hover:bg-accent focus-visible:ring-ring/50 flex items-start gap-3 rounded-md px-2 py-2 text-sm outline-none focus-visible:ring-[3px]"
                      >
                        <A.icon
                          aria-hidden
                          className="text-muted-foreground mt-0.5 size-4 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-medium">{i.title}</span>
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {A.label}
                            </span>
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {i.detail}
                            {i.at && i.kind !== "expiring" ? ` · ${formatRelative(i.at, now)}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <CircleSlashIcon aria-hidden className="size-4" />
                Nothing needs you right now.
              </p>
            )}
          </ChartCard>
        </div>

        {money && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Orders"
              description="Orders placed that count as sales."
              table={seriesTable("orders", formatCount)}
            >
              <TimeChart
                kind="bar"
                format="count"
                name="Orders"
                prevName={prevName}
                height={200}
                label={`Orders over ${range.label}`}
                data={points.map((p) => ({ label: p.label, value: p.orders, prev: p.prevOrders }))}
              />
            </ChartCard>
            <ChartCard
              title="Average order"
              description="Order totals before refunds, per order. A gap means no orders."
              table={seriesTable("aov", formatPrice)}
            >
              <TimeChart
                kind="line"
                format="taka"
                name="Average order"
                height={200}
                label={`Average order value over ${range.label}`}
                data={points.map((p) => ({ label: p.label, value: p.aov }))}
              />
            </ChartCard>
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <ChartCard
            className="xl:col-span-2"
            title={money ? "Top fragrances" : "Top fragrances by bottles"}
            description={
              money
                ? "Ranked by item sales: bottle prices before order discounts."
                : "Ranked by bottles sold."
            }
            action={
              <Link
                href={`/admin/reports?report=products&${rq}`}
                className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap underline-offset-4 hover:underline"
              >
                Full report
              </Link>
            }
          >
            <RankTable
              caption={`Top fragrances, ${range.label}`}
              columns={[
                "Fragrance",
                "Bottles",
                "Orders",
                ...(money ? ["Item sales"] : []),
                "Share",
              ]}
              rows={top.map((f) => ({
                key: String(f.fragranceId ?? f.name),
                name: f.name,
                value: money ? f.revenue : f.bottles,
                cells: [
                  formatCount(f.bottles),
                  formatCount(f.orders),
                  ...(money ? [formatTaka(f.revenue)] : []),
                  percent(money ? f.revenue : f.bottles, fragTotal),
                ],
              }))}
              empty="No bottles sold in this period."
            />
          </ChartCard>

          <ChartCard
            title="Orders by status"
            description="Every order placed in the period, where it stands now."
            table={{
              columns: ["Status", "Orders", "Share"],
              rows: statuses
                .slice()
                .sort((a, b) => b.orders - a.orders)
                .map((s) => [
                  STATUS_LABELS[s.status],
                  formatCount(s.orders),
                  percent(s.orders, statusTotal),
                ]),
            }}
          >
            <BarList
              dense
              rows={statuses
                .slice()
                .sort((a, b) => b.orders - a.orders)
                .map((s) => ({
                  key: s.status,
                  label: STATUS_LABELS[s.status],
                  value: s.orders,
                  display: formatCount(s.orders),
                  href: `/admin/orders?status=${s.status}`,
                }))}
              empty="No orders in this period."
            />
          </ChartCard>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <ChartCard title="How customers paid" description="Orders that count as sales.">
            <SplitBar
              parts={(["sslcommerz", "cod"] as const).map((k) => {
                const r = methods.find((x) => x.key === k);
                return {
                  key: k,
                  label: k === "cod" ? "Cash on delivery" : "Online",
                  value: r?.orders ?? 0,
                  display: `${formatCount(r?.orders ?? 0)}${money ? ` · ${formatTaka(r?.revenue ?? 0)}` : ""}`,
                };
              })}
              empty="No orders in this period."
            />
          </ChartCard>
          <ChartCard title="Where they live" description="By delivery zone.">
            <SplitBar
              parts={(["inside_dhaka", "outside_dhaka"] as const).map((k) => {
                const r = zones.find((x) => x.key === k);
                return {
                  key: k,
                  label: k === "inside_dhaka" ? "Inside Dhaka" : "Outside Dhaka",
                  value: r?.orders ?? 0,
                  display: `${formatCount(r?.orders ?? 0)}${money ? ` · ${formatTaka(r?.revenue ?? 0)}` : ""}`,
                };
              })}
              empty="No orders in this period."
            />
          </ChartCard>
          <ChartCard title="Bottle sizes" description="Bottles sold, by size.">
            {sizes.length === 1 ? (
              <p className="text-sm">
                <span className="text-2xl font-semibold">{formatCount(sizes[0]!.bottles)}</span>
                <span className="text-muted-foreground ml-2">
                  bottles, all {sizes[0]!.label}
                  {money ? ` · ${formatTaka(sizes[0]!.revenue)}` : ""}
                </span>
              </p>
            ) : (
              <SplitBar
                parts={sizes.map((s) => ({
                  key: s.label,
                  label: s.label,
                  value: s.bottles,
                  display: `${formatCount(s.bottles)}${money ? ` · ${formatTaka(s.revenue)}` : ""}`,
                }))}
                empty="No bottles sold in this period."
              />
            )}
          </ChartCard>
        </div>
      </section>
    </>
  );
}
