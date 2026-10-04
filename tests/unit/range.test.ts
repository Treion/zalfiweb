import { describe, expect, it } from "vitest";
import {
  bucketFor,
  bucketKey,
  bucketKeys,
  bucketLabel,
  dayStart,
  dhakaDay,
  parseRange,
  periodLabel,
  rangeQuery,
} from "@/server/reports/range";

// 4 Oct 2026, 1:30 am in Dhaka (still 3 Oct in UTC)
const now = new Date("2026-10-03T19:30:00Z");
const H = 3600_000;
const DAY = 24 * H;

describe("Dhaka days", () => {
  it("reads the calendar day in Dhaka, not UTC", () => {
    expect(dhakaDay(now)).toBe("2026-10-04");
    expect(dayStart("2026-10-04")?.toISOString()).toBe("2026-10-03T18:00:00.000Z");
    expect(dayStart("2026-02-30")).toBeNull();
    expect(dayStart("4 Oct")).toBeNull();
  });
});

describe("parseRange", () => {
  it("today runs from Dhaka midnight, by the hour, against yesterday", () => {
    const r = parseRange({ range: "today" }, now);
    expect(r.from.toISOString()).toBe("2026-10-03T18:00:00.000Z");
    expect(r.to.getTime() - r.from.getTime()).toBe(DAY);
    expect(r.bucket).toBe("hour");
    expect(r.prev.to).toEqual(r.from);
    expect(r.prev.from.toISOString()).toBe("2026-10-02T18:00:00.000Z");
    expect(r.label).toBe("4 Oct 2026");
  });

  it("the last 7 and 30 days include today, by the day", () => {
    const w = parseRange({ range: "7d" }, now);
    expect(w.fromDay).toBe("2026-09-28");
    expect(w.toDay).toBe("2026-10-04");
    expect(w.bucket).toBe("day");
    expect(w.prev.to).toEqual(w.from);
    expect(w.label).toBe("28 Sept – 4 Oct 2026");
    const m = parseRange({ range: "30d" }, now);
    expect(m.fromDay).toBe("2026-09-05");
    expect(parseRange({ range: "90d" }, now).bucket).toBe("week");
  });

  it("this month compares with the same days of last month", () => {
    const r = parseRange({ range: "month" }, now);
    expect(r.fromDay).toBe("2026-10-01");
    expect(r.toDay).toBe("2026-10-04");
    expect(r.prev.label).toBe("1 Sept – 4 Sept 2026");
    // On the 31st, last month is clamped to its own length
    const late = parseRange({ range: "month" }, new Date("2026-03-30T20:00:00Z"));
    expect(late.prev.from.toISOString()).toBe("2026-01-31T18:00:00.000Z");
    expect(late.prev.to).toEqual(late.from);
  });

  it("custom ranges are whole Dhaka days, in either order, at most a year", () => {
    const r = parseRange({ range: "custom", from: "2026-10-04", to: "2026-09-01" }, now);
    expect(r.fromDay).toBe("2026-09-01");
    expect(r.toDay).toBe("2026-10-04");
    expect(r.bucket).toBe("week");
    expect(rangeQuery(r)).toBe("range=custom&from=2026-09-01&to=2026-10-04");
    const long = parseRange({ range: "custom", from: "2024-01-01", to: "2026-10-04" }, now);
    expect((long.to.getTime() - long.from.getTime()) / DAY).toBe(366);
    expect(long.bucket).toBe("month");
  });

  it("falls back on anything it can't read", () => {
    expect(parseRange({ range: "forever" }, now).key).toBe("30d");
    expect(parseRange({ range: "custom", from: "nope", to: "2026-10-01" }, now).key).toBe("30d");
    expect(parseRange({}, now, "7d").key).toBe("7d");
  });
});

describe("buckets", () => {
  it("picks hours, days, weeks or months by length", () => {
    const at = (d: number) => [new Date(0), new Date(d * DAY)] as const;
    expect(bucketFor(...at(1))).toBe("hour");
    expect(bucketFor(...at(31))).toBe("day");
    expect(bucketFor(...at(90))).toBe("week");
    expect(bucketFor(...at(200))).toBe("month");
  });

  it("keys buckets on the Dhaka wall clock, weeks from Monday", () => {
    expect(bucketKey(now, "hour")).toBe("2026-10-04T01");
    expect(bucketKey(now, "day")).toBe("2026-10-04T00");
    // 4 Oct 2026 is a Sunday: its week began on Monday 28 Sept
    expect(bucketKey(now, "week")).toBe("2026-09-28T00");
    expect(bucketKey(now, "month")).toBe("2026-10-01T00");
  });

  it("lists every bucket, so empty ones show", () => {
    const r = parseRange({ range: "7d" }, now);
    const keys = bucketKeys(r.from, r.to, r.bucket);
    expect(keys).toHaveLength(7);
    expect(keys[0]).toBe("2026-09-28T00");
    expect(keys.at(-1)).toBe("2026-10-04T00");
    expect(bucketKeys(r.from, r.to, "hour")).toHaveLength(7 * 24);
    const q = parseRange({ range: "90d" }, now);
    expect(bucketKeys(q.from, q.to, "week")[0]).toBe("2026-07-06T00");
  });

  it("labels buckets in plain words", () => {
    expect(bucketLabel("2026-10-04T09", "hour")).toBe("9 am");
    expect(bucketLabel("2026-10-04T00", "day")).toBe("4 Oct");
    expect(bucketLabel("2026-09-28T00", "week")).toBe("w/c 28 Sept");
    expect(bucketLabel("2026-10-01T00", "month")).toBe("Oct 2026");
    // Across a new year, both dates carry their year
    expect(periodLabel(new Date("2025-12-30T18:00:00Z"), new Date("2026-01-01T18:00:00Z"))).toBe(
      "31 Dec 2025 – 1 Jan 2026",
    );
  });
});
