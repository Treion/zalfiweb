import { TIME_ZONE, dhakaDayStart } from "@/lib/time";

/**
 * Report periods, in Bangladesh time (UTC+6 all year). A period is [from, to) in UTC instants,
 * split into buckets (hours, days, weeks starting Monday, or months) that the SQL groups by the
 * same way (`date_trunc` on the Dhaka wall clock), so every bucket can be filled in, zeros too.
 * Each period has a previous one to compare with: the same length just before it, or for
 * "this month", the same days of last month.
 */

export const RANGE_KEYS = ["today", "7d", "30d", "month", "90d", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export type Bucket = "hour" | "day" | "week" | "month";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  "90d": "Last 90 days",
  custom: "Custom",
};

export type Range = {
  key: RangeKey;
  from: Date;
  to: Date;
  bucket: Bucket;
  /** "4 Oct 2026", "28 Sept – 4 Oct 2026" */
  label: string;
  prev: { from: Date; to: Date; label: string };
  /** Dhaka calendar days, for the custom inputs: "2026-10-01" */
  fromDay: string;
  toDay: string;
};

const H = 3600_000;
const DAY = 24 * H;
const OFFSET = 6 * H;
const MAX_DAYS = 366;

/** The Dhaka calendar day of an instant: "2026-10-04" */
export const dhakaDay = (d: Date) => new Date(d.getTime() + OFFSET).toISOString().slice(0, 10);

/** The UTC instant of Dhaka midnight starting a "YYYY-MM-DD" day, or null if it isn't a date */
export function dayStart(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T00:00:00+06:00`);
  if (Number.isNaN(t) || dhakaDay(new Date(t)) !== day) return null;
  return new Date(t);
}

const monthStart = (d: Date) => {
  const l = new Date(d.getTime() + OFFSET);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), 1) - OFFSET);
};

const addMonths = (d: Date, n: number) => {
  const l = new Date(d.getTime() + OFFSET);
  const target = new Date(
    Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + n, 1, l.getUTCHours(), l.getUTCMinutes()),
  );
  // Keep the day of the month, clamped to the target month's length
  const days = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(l.getUTCDate(), days));
  return new Date(target.getTime() - OFFSET);
};

const short = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});
const full = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "4 Oct 2026" for one day, "28 Sept – 4 Oct 2026" for several ([from, to) as Dhaka days) */
export function periodLabel(from: Date, to: Date) {
  const last = new Date(to.getTime() - 1);
  if (dhakaDay(from) === dhakaDay(last)) return full.format(from);
  const sameYear = dhakaDay(from).slice(0, 4) === dhakaDay(last).slice(0, 4);
  return `${sameYear ? short.format(from) : full.format(from)} – ${full.format(last)}`;
}

/** Hours for a day or two, days up to a month, weeks up to half a year, then months */
export function bucketFor(from: Date, to: Date): Bucket {
  const days = (to.getTime() - from.getTime()) / DAY;
  if (days <= 2) return "hour";
  if (days <= 31) return "day";
  if (days <= 180) return "week";
  return "month";
}

/** The period chosen in the URL (?range=7d, or ?range=custom&from=…&to=…), seen at `now` */
export function parseRange(
  sp: { range?: string | string[]; from?: string | string[]; to?: string | string[] },
  now: Date = new Date(),
  fallback: RangeKey = "30d",
): Range {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const asked = one(sp.range);
  const key: RangeKey = (RANGE_KEYS as readonly string[]).includes(asked)
    ? (asked as RangeKey)
    : fallback;
  const today = dhakaDayStart(now);
  const end = new Date(today.getTime() + DAY);
  let from: Date;
  let to = end;
  let prev: { from: Date; to: Date } | null = null;

  switch (key) {
    case "today":
      from = today;
      break;
    case "7d":
      from = new Date(today.getTime() - 6 * DAY);
      break;
    case "30d":
      from = new Date(today.getTime() - 29 * DAY);
      break;
    case "90d":
      from = new Date(today.getTime() - 89 * DAY);
      break;
    case "month":
      from = monthStart(now);
      // The same days of last month (1–4 Oct against 1–4 Sept)
      prev = { from: addMonths(from, -1), to: addMonths(end, -1) };
      if (prev.to > from) prev.to = from;
      break;
    case "custom": {
      const a = dayStart(one(sp.from));
      const b = dayStart(one(sp.to));
      if (!a || !b) return parseRange({ range: fallback }, now, fallback);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      from = lo;
      to = new Date(Math.min(hi.getTime() + DAY, lo.getTime() + MAX_DAYS * DAY));
      break;
    }
  }
  const length = to.getTime() - from.getTime();
  prev ??= { from: new Date(from.getTime() - length), to: from };
  return {
    key,
    from,
    to,
    bucket: bucketFor(from, to),
    label: periodLabel(from, to),
    prev: { ...prev, label: periodLabel(prev.from, prev.to) },
    fromDay: dhakaDay(from),
    toDay: dhakaDay(new Date(to.getTime() - 1)),
  };
}

/** The SQL `date_trunc` unit and the key format that match bucketKey() */
export const BUCKET_SQL: Record<Bucket, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
};

/** A bucket's key, as the SQL writes it: the Dhaka wall-clock start, "2026-10-04T09" */
export function bucketKey(d: Date, bucket: Bucket) {
  const l = new Date(d.getTime() + OFFSET);
  if (bucket !== "hour") l.setUTCHours(0, 0, 0, 0);
  else l.setUTCMinutes(0, 0, 0);
  if (bucket === "week") l.setUTCDate(l.getUTCDate() - ((l.getUTCDay() + 6) % 7));
  if (bucket === "month") l.setUTCDate(1);
  return l.toISOString().slice(0, 13);
}

const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  hour12: true,
});
const monthFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  month: "short",
  year: "numeric",
});

/** Plain words for a bucket: "9 am", "4 Oct", "w/c 28 Sept", "Oct 2026" */
export function bucketLabel(key: string, bucket: Bucket) {
  const d = new Date(`${key}:00:00+06:00`);
  if (bucket === "hour") return hourFmt.format(d).replace(/\s/g, " ");
  if (bucket === "day") return short.format(d);
  if (bucket === "week") return `w/c ${short.format(d)}`;
  return monthFmt.format(d);
}

/** Every bucket in [from, to), in order, so empty ones show as zero */
export function bucketKeys(from: Date, to: Date, bucket: Bucket): string[] {
  const keys: string[] = [];
  let at = new Date(`${bucketKey(from, bucket)}:00:00+06:00`);
  for (let guard = 0; at < to && guard < 1000; guard++) {
    keys.push(bucketKey(at, bucket));
    at =
      bucket === "hour"
        ? new Date(at.getTime() + H)
        : bucket === "day"
          ? new Date(at.getTime() + DAY)
          : bucket === "week"
            ? new Date(at.getTime() + 7 * DAY)
            : addMonths(at, 1);
  }
  return keys;
}

/** The query string for a period, for links that keep it */
export function rangeQuery(r: Pick<Range, "key" | "fromDay" | "toDay">) {
  return r.key === "custom" ? `range=custom&from=${r.fromDay}&to=${r.toDay}` : `range=${r.key}`;
}
