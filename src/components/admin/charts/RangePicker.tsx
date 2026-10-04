import Link from "next/link";
import { CalendarIcon, CheckIcon } from "lucide-react";
import { cn } from "@/components/admin/lib/utils";
import { RANGE_LABELS, rangeQuery, type Range, type RangeKey } from "@/server/reports/range";

const PRESETS: RangeKey[] = ["today", "7d", "30d", "month", "90d"];

/**
 * The one filter row above a dashboard's charts: the period (presets, or a custom range of Dhaka
 * days) and, where it applies, "compare to previous period". Plain links and a GET form, so the
 * period lives in the URL and every chart below reads the same one.
 */
export function RangePicker({
  range,
  basePath,
  keep = {},
  compare,
}: {
  range: Range;
  basePath: string;
  /** Other query values to carry along (the report shown, say) */
  keep?: Record<string, string>;
  /** Whether comparison is on; leave out where there's nothing to compare */
  compare?: boolean;
}) {
  const extra = new URLSearchParams(keep);
  const href = (q: string, cmp = compare) => {
    const p = new URLSearchParams(q);
    for (const [k, v] of extra) p.set(k, v);
    if (cmp) p.set("compare", "1");
    return `${basePath}?${p.toString()}`;
  };
  return (
    <div className="mb-6 flex max-w-full min-w-0 flex-wrap items-center gap-2">
      <nav
        aria-label="Period"
        className="bg-muted text-muted-foreground inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg p-[3px] text-sm"
      >
        {PRESETS.map((k) => (
          <Link
            key={k}
            href={href(`range=${k}`)}
            aria-current={range.key === k ? "true" : undefined}
            className={cn(
              "rounded-md px-3 py-1 font-medium whitespace-nowrap",
              range.key === k ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
            )}
          >
            {RANGE_LABELS[k]}
          </Link>
        ))}
      </nav>
      <details className="group relative">
        <summary
          className={cn(
            "border-input hover:bg-accent inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm font-medium select-none",
            range.key === "custom" && "bg-background",
          )}
        >
          <CalendarIcon aria-hidden className="text-muted-foreground size-4" />
          {range.key === "custom" ? range.label : "Custom"}
        </summary>
        <form
          action={basePath}
          className="bg-popover text-popover-foreground absolute top-11 left-0 z-20 flex w-72 flex-col gap-3 rounded-lg border p-4 shadow-md"
        >
          <input type="hidden" name="range" value="custom" />
          {[...extra].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {compare && <input type="hidden" name="compare" value="1" />}
          <label className="flex flex-col gap-1 text-sm">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.fromDay}
              required
              className="border-input bg-background h-9 rounded-md border px-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.toDay}
              required
              className="border-input bg-background h-9 rounded-md border px-2"
            />
          </label>
          <p className="text-muted-foreground text-xs">Bangladesh days, up to a year.</p>
          <button
            type="submit"
            className="bg-primary text-primary-foreground h-9 rounded-md text-sm font-medium"
          >
            Show
          </button>
        </form>
      </details>
      {compare !== undefined && (
        <Link
          href={href(rangeQuery(range), !compare)}
          role="switch"
          aria-checked={compare}
          className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-2 px-1 text-sm"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-4 place-items-center rounded-[4px] border",
              compare && "bg-primary border-primary text-primary-foreground",
            )}
          >
            {compare && <CheckIcon className="size-3" />}
          </span>
          Compare with {range.prev.label}
        </Link>
      )}
    </div>
  );
}
