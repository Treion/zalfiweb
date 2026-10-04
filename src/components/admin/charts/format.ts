import { formatPrice } from "@/lib/money";

/**
 * Numbers for charts. Axis ticks are compact, in the way Bangladesh counts money: thousands (K),
 * lakh (L, 1,00,000) and crore (Cr, 1,00,00,000). Everything else uses the full figure.
 */
export type ValueFormat = "taka" | "count";

const trim = (x: number) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString();

/** ৳950, ৳12.5K, ৳1.2L, ৳3Cr (from poisha) */
export function compactTaka(poisha: number) {
  const t = Math.abs(poisha) / 100;
  const sign = poisha < 0 ? "−" : "";
  if (t < 1000) return `${sign}৳${Math.round(t)}`;
  if (t < 100_000) return `${sign}৳${trim(t / 1000)}K`;
  if (t < 10_000_000) return `${sign}৳${trim(t / 100_000)}L`;
  return `${sign}৳${trim(t / 10_000_000)}Cr`;
}

export const formatCount = (n: number) => new Intl.NumberFormat("en-IN").format(n);

/** Whole taka, for headline figures and charts (tables keep the poisha): ৳6,40,648 */
export const formatTaka = (poisha: number) => formatPrice(Math.round(poisha / 100) * 100);

export const formatValue = (v: number, f: ValueFormat) =>
  f === "taka" ? formatTaka(v) : formatCount(v);
export const formatTick = (v: number, f: ValueFormat) =>
  f === "taka" ? compactTaka(v) : formatCount(v);

/** A share as "38%" ("<1%" for a sliver, so nothing reads as zero that isn't) */
export function percent(part: number, whole: number) {
  if (!whole || !part) return "0%";
  const p = (part / whole) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

export type Delta = {
  direction: "up" | "down" | "flat";
  /** "+12%", "−3", "No change" */
  text: string;
  /** Whether this change is good news (more revenue: yes; more failed deliveries: no) */
  tone: "good" | "bad" | "neutral";
};

/**
 * The change from `then` to `now`. Money and orders compare in percent; small counts (queues,
 * sold-out sizes) in units, where "+2" says more than "+67%". `upIsGood` sets the tone.
 */
export function delta(
  now: number,
  then: number,
  opts: { upIsGood: boolean; units?: boolean },
): Delta {
  const diff = now - then;
  if (!diff) return { direction: "flat", text: "No change", tone: "neutral" };
  const direction = diff > 0 ? "up" : "down";
  const tone = diff > 0 === opts.upIsGood ? "good" : "bad";
  if (opts.units || !then) {
    const text = opts.units ? `${diff > 0 ? "+" : "−"}${formatCount(Math.abs(diff))}` : "New";
    return { direction, text, tone };
  }
  const pct = Math.round((Math.abs(diff) / Math.abs(then)) * 100);
  return { direction, text: `${diff > 0 ? "+" : "−"}${pct || "<1"}%`, tone };
}
