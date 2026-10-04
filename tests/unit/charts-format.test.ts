import { describe, expect, it } from "vitest";
import {
  compactTaka,
  delta,
  formatTick,
  formatValue,
  percent,
} from "@/components/admin/charts/format";

describe("chart numbers", () => {
  it("compact taka the Bangladeshi way", () => {
    expect(compactTaka(95_000)).toBe("৳950");
    expect(compactTaka(1_250_000)).toBe("৳12.5K");
    expect(compactTaka(9_999_900)).toBe("৳100K");
    expect(compactTaka(12_000_000)).toBe("৳1.2L");
    expect(compactTaka(450_000_000)).toBe("৳45L");
    expect(compactTaka(3_000_000_000)).toBe("৳3Cr");
    expect(compactTaka(-1_250_000)).toBe("−৳12.5K");
    expect(formatTick(0, "taka")).toBe("৳0");
    expect(formatValue(12_500_000, "taka")).toBe("৳1,25,000");
    expect(formatValue(64_064_750, "taka")).toBe("৳6,40,648");
    expect(formatValue(125_000, "count")).toBe("1,25,000");
  });

  it("shares", () => {
    expect(percent(38, 100)).toBe("38%");
    expect(percent(1, 400)).toBe("<1%");
    expect(percent(0, 0)).toBe("0%");
  });

  it("changes, with good or bad news by measure", () => {
    expect(delta(120, 100, { upIsGood: true })).toEqual({
      direction: "up",
      text: "+20%",
      tone: "good",
    });
    expect(delta(80, 100, { upIsGood: true })).toEqual({
      direction: "down",
      text: "−20%",
      tone: "bad",
    });
    expect(delta(5, 3, { upIsGood: false, units: true })).toEqual({
      direction: "up",
      text: "+2",
      tone: "bad",
    });
    expect(delta(2, 3, { upIsGood: false, units: true }).tone).toBe("good");
    expect(delta(4, 4, { upIsGood: true })).toEqual({
      direction: "flat",
      text: "No change",
      tone: "neutral",
    });
    expect(delta(10, 0, { upIsGood: true }).text).toBe("New");
    expect(delta(1001, 1000, { upIsGood: true }).text).toBe("+<1%");
  });
});
