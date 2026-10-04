"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTick, formatValue, type ValueFormat } from "./format";

/**
 * A measure over time: an area (revenue), columns (orders) or a line (average order value), with
 * the previous period as a grey line on the same axis when asked. One series is the point; the
 * previous period is context. Thin marks, hairline grid, no animation, and a tooltip that lists
 * both series at the hovered bucket. The table under every chart carries the same numbers.
 */
export type TimePoint = { label: string; value: number | null; prev?: number | null };

export function TimeChart({
  data,
  kind,
  format,
  name,
  prevName,
  height = 240,
  label,
}: {
  data: TimePoint[];
  kind: "area" | "bar" | "line";
  format: ValueFormat;
  name: string;
  /** Shown (as a grey line) only when given */
  prevName?: string;
  height?: number;
  /** What the chart shows, for screen readers */
  label: string;
}) {
  const withPrev = !!prevName && data.some((d) => d.prev != null);
  // Nothing in the period (and nothing to compare): keep the frame, say so, and give the axis a
  // sensible top instead of four zeros
  const empty = data.every((d) => !d.value) && !(withPrev && data.some((d) => d.prev));
  return (
    <div>
      {withPrev && (
        <ul className="text-muted-foreground mb-2 flex flex-wrap gap-4 text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-[var(--chart-1)]" />
            {name}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-[var(--chart-prev)]" />
            {prevName}
          </li>
        </ul>
      )}
      <div role="img" aria-label={label} className="relative" style={{ height }}>
        {empty && (
          <p className="text-muted-foreground pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center text-sm">
            Nothing yet in this period.
          </p>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-axis)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={28}
              tickMargin={8}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              tickFormatter={(v: number) => formatTick(v, format)}
              allowDecimals={false}
              tickCount={4}
              domain={[0, (max: number) => (max > 0 ? max : format === "taka" ? 100_000 : 4)]}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={
                kind === "bar"
                  ? { fill: "var(--muted)", opacity: 0.7 }
                  : { stroke: "var(--chart-axis)", strokeWidth: 1 }
              }
              content={(p) => (
                <Readout
                  active={p.active}
                  payload={p.payload as readonly { payload?: unknown }[] | undefined}
                  label={p.label}
                  format={format}
                  name={name}
                  prevName={withPrev ? prevName : undefined}
                />
              )}
            />
            {kind === "area" && (
              <Area
                dataKey="value"
                name={name}
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.1}
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--chart-1)" }}
                isAnimationActive={false}
              />
            )}
            {kind === "bar" && (
              <Bar
                dataKey="value"
                name={name}
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            )}
            {kind === "line" && (
              <Line
                dataKey="value"
                name={name}
                type="monotone"
                stroke="var(--chart-1)"
                strokeWidth={2}
                strokeLinecap="round"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2, fill: "var(--chart-1)" }}
                isAnimationActive={false}
              />
            )}
            {withPrev && (
              <Line
                dataKey="prev"
                name={prevName}
                type="monotone"
                stroke="var(--chart-prev)"
                strokeWidth={2}
                strokeLinecap="round"
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: "var(--card)",
                  strokeWidth: 2,
                  fill: "var(--chart-prev)",
                }}
                isAnimationActive={false}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** The hover readout: the bucket, then each series with its value first */
function Readout({
  active,
  payload,
  label,
  format,
  name,
  prevName,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  label?: unknown;
  format: ValueFormat;
  name: string;
  prevName?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as TimePoint | undefined;
  if (!point) return null;
  const rows = [
    { key: "now", name, value: point.value, color: "var(--chart-1)" },
    ...(prevName && point.prev != null
      ? [{ key: "prev", name: prevName, value: point.prev, color: "var(--chart-prev)" }]
      : []),
  ];
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-sm">
      <p className="text-muted-foreground mb-1">{String(label ?? point.label)}</p>
      {rows.map((r) => (
        <p key={r.key} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />
          <span className="font-semibold tabular-nums">
            {r.value == null ? "None" : formatValue(r.value, format)}
          </span>
          <span className="text-muted-foreground">{r.name}</span>
        </p>
      ))}
    </div>
  );
}
