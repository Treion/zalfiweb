import { describe, expect, it } from "vitest";
import { DHAKA_AREAS, DHAKA_CITY_THANAS, DISTRICTS } from "@/lib/bd-geo";
import { dhakaDayStart, formatDateTime } from "@/lib/time";
import { csvCell, toCsv } from "@/server/admin/csv";

describe("Bangladesh geography", () => {
  it("lists all 64 districts once", () => {
    expect(DISTRICTS).toHaveLength(64);
    expect(new Set(DISTRICTS).size).toBe(64);
  });
  it("counts the store's own thana (Ramna, for Kakrail) as inside Dhaka", () => {
    expect(DHAKA_CITY_THANAS).toContain("Ramna");
  });
  it("has no duplicate Dhaka areas", () => {
    expect(new Set(DHAKA_AREAS).size).toBe(DHAKA_AREAS.length);
  });
});

describe("Dhaka time", () => {
  it("starts the day at Dhaka midnight (18:00 UTC the day before)", () => {
    expect(dhakaDayStart(new Date("2026-10-02T17:59:00Z")).toISOString()).toBe(
      "2026-10-01T18:00:00.000Z",
    );
    expect(dhakaDayStart(new Date("2026-10-02T18:01:00Z")).toISOString()).toBe(
      "2026-10-02T18:00:00.000Z",
    );
  });
  it("shows Dhaka local time", () => {
    expect(formatDateTime(new Date("2026-10-02T12:30:00Z"))).toMatch(/2 Oct 2026, 6:30\s?pm/i);
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('Rafi, "the" one')).toBe('"Rafi, ""the"" one"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+8801712")).toBe("'+8801712");
    expect(csvCell("-5")).toBe("'-5");
  });
  it("writes rows with CRLF", () => {
    expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n");
  });
});
