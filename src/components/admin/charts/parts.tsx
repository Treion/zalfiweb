import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/admin/ui/card";
import { cn } from "@/components/admin/lib/utils";
import { percent, type Delta } from "./format";

/**
 * The chart kit's plain-HTML pieces (no client JavaScript): a card that pairs every chart with its
 * table, stat tiles, a list of horizontal bars, and a part-to-whole bar. Colours come from the
 * validated chart tokens in admin.css; text always uses text colours, never the data colour.
 */

export type TableView = {
  columns: string[];
  rows: (string | number)[][];
  align?: ("left" | "right")[];
};

export function ChartCard({
  title,
  description,
  table,
  className,
  children,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  table?: TableView;
  className?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-4", className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {table && table.rows.length > 0 && <TableDetails table={table} title={title} />}
      </CardContent>
    </Card>
  );
}

/** The numbers behind a chart, folded away under it */
export function TableDetails({ table, title }: { table: TableView; title: string }) {
  return (
    <details className="group text-sm">
      <summary className="text-muted-foreground hover:text-foreground w-fit cursor-pointer text-xs select-none">
        <span className="group-open:hidden">Show the numbers</span>
        <span className="hidden group-open:inline">Hide the numbers</span>
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-muted/60 text-muted-foreground sticky top-0">
            <tr>
              {table.columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "px-3 py-1.5 font-medium",
                    (table.align?.[i] ?? (i ? "right" : "left")) === "right"
                      ? "text-right"
                      : "text-left",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {table.rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-1.5 tabular-nums",
                      (table.align?.[i] ?? (i ? "right" : "left")) === "right"
                        ? "text-right"
                        : "text-left",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const TONE = {
  good: "text-[var(--tone-success-fg)]",
  bad: "text-[var(--tone-danger-fg)]",
  neutral: "text-muted-foreground",
};

/** A number, its change, and what it's compared with. Links to the list behind it. */
export function StatTile({
  label,
  value,
  delta,
  compare,
  href,
}: {
  label: string;
  value: string;
  delta?: Delta | null;
  compare?: string;
  href?: string;
}) {
  const Icon =
    delta?.direction === "up"
      ? ArrowUpRightIcon
      : delta?.direction === "down"
        ? ArrowDownRightIcon
        : MinusIcon;
  const body = (
    <>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-xl font-semibold sm:text-2xl">{value}</p>
      {delta ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-1 text-xs">
          <span className={cn("inline-flex items-center gap-0.5 font-medium", TONE[delta.tone])}>
            <Icon aria-hidden className="size-3.5" />
            {delta.text}
          </span>
          {compare && <span className="text-muted-foreground">{compare}</span>}
        </p>
      ) : (
        compare && <p className="text-muted-foreground mt-1 text-xs">{compare}</p>
      )}
    </>
  );
  const cls = "bg-card text-card-foreground block rounded-xl border px-4 py-3.5 shadow-xs";
  return href ? (
    <Link
      href={href}
      className={cn(
        cls,
        "hover:bg-accent/60 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px]",
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export type BarRow = {
  key: string;
  label: string;
  value: number;
  display: string;
  href?: string;
  sub?: string;
};

/**
 * Horizontal bars for categories (one series, one colour), the value at the bar's end. Good for
 * long names and many rows, where a pie would blur. `dense` puts label, bar and value on one line.
 */
export function BarList({
  rows,
  empty = "Nothing yet.",
  dense = false,
}: {
  rows: BarRow[];
  empty?: string;
  dense?: boolean;
}) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const bar = (r: BarRow) => (
    <span
      aria-hidden
      className="block h-2.5 rounded-r-[4px] bg-[var(--chart-1)]"
      style={{ width: `${r.value > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%` }}
    />
  );
  return (
    <ul className={cn("flex flex-col", dense ? "gap-1" : "gap-2.5")}>
      {rows.map((r) => {
        const inner = dense ? (
          <span className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 py-1 text-sm">
            <span className="truncate">{r.label}</span>
            {bar(r)}
            <span className="min-w-8 text-right font-medium tabular-nums">{r.display}</span>
          </span>
        ) : (
          <>
            <span className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {r.label}
                {r.sub && <span className="text-muted-foreground ml-1.5 text-xs">{r.sub}</span>}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{r.display}</span>
            </span>
            {bar(r)}
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link
                href={r.href}
                className="focus-visible:ring-ring/50 hover:bg-accent/60 -mx-1.5 block rounded-sm px-1.5 outline-none focus-visible:ring-[3px]"
              >
                {inner}
              </Link>
            ) : (
              <span className="block">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type RankRow = {
  key: string;
  name: string;
  /** What the bar measures */
  value: number;
  cells: string[];
};

/**
 * A ranked table with a bar in each row: the best sellers, with their figures beside the bar, so
 * the chart and the table are one thing.
 */
export function RankTable({
  columns,
  rows,
  empty = "Nothing yet.",
  caption,
}: {
  columns: string[];
  rows: RankRow[];
  empty?: string;
  caption: string;
}) {
  if (!rows.length) return <p className="text-muted-foreground text-sm">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th scope="col" className="w-7 pr-2 pb-2 font-medium">
              #
            </th>
            <th scope="col" className="pb-2 font-medium">
              {columns[0]}
            </th>
            {columns.slice(1).map((c) => (
              <th key={c} scope="col" className="pb-2 pl-4 text-right font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className="border-t">
              <td className="text-muted-foreground py-2 pr-2 align-top tabular-nums">{i + 1}</td>
              <td className="w-1/2 py-2 align-top">
                <span className="block truncate">{r.name}</span>
                <span
                  aria-hidden
                  className="mt-1 block h-1.5 rounded-r-[4px] bg-[var(--chart-1)]"
                  style={{ width: `${r.value > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%` }}
                />
              </td>
              {r.cells.map((c, ci) => (
                <td key={ci} className="py-2 pl-4 text-right align-top tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type SplitPart = { key: string; label: string; value: number; display: string };

/**
 * Part of a whole in one bar: segments in the first chart colours, a 2px gap between them, and a
 * legend that names each part with its value and share (so colour never carries it alone).
 */
export function SplitBar({
  parts,
  empty = "Nothing yet.",
}: {
  parts: SplitPart[];
  empty?: string;
}) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (!total) return <p className="text-muted-foreground text-sm">{empty}</p>;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 gap-0.5" aria-hidden>
        {shown.map((p, i) => (
          <div
            key={p.key}
            className={cn(
              "h-full",
              i === 0 && "rounded-l-[4px]",
              i === shown.length - 1 && "rounded-r-[4px]",
            )}
            style={{
              flexGrow: p.value,
              flexBasis: 0,
              minWidth: 3,
              background: `var(--chart-${(parts.indexOf(p) % 8) + 1})`,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: `var(--chart-${(i % 8) + 1})` }}
            />
            <span className="flex-1 truncate">{p.label}</span>
            <span className="font-medium tabular-nums">{p.display}</span>
            <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
              {percent(p.value, total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
