import { describe, expect, it } from "vitest";
import { FRAGRANCES } from "@/db/seed-data";
import { filtersToQuery, matches, notesInUse, NO_FILTERS, parseFilters } from "@/lib/collection";

const notes = notesInUse(FRAGRANCES).map((n) => n.slug);
const params = (q: string) => new URLSearchParams(q);
const shown = (q: string) =>
  FRAGRANCES.filter((f) => matches(f, parseFilters(params(q), notes))).map((f) => f.slug);

describe("all fragrances: filters", () => {
  it("shows everything with no filter", () => {
    expect(shown("")).toHaveLength(FRAGRANCES.length);
  });

  it("matches any choice within a group, and every group together", () => {
    expect(shown("wear=night")).toEqual(["oudor"]);
    expect(shown("wear=evening,night")).toEqual(["maree", "solea", "bond", "oudor"]);
    expect(shown("wear=evening&season=winter")).toEqual(["bond", "oudor"]);
    expect(shown("note=vanilla")).toEqual(["solea", "bond"]);
    expect(shown("note=vanilla&wear=day")).toEqual(["solea"]);
  });

  it("ignores anything it doesn't know, and round-trips through the address bar", () => {
    const f = parseFilters(params("wear=EVENING,brunch&note=oud,plastic&x=1"), notes);
    expect(f).toEqual({ wear: ["evening"], season: [], note: ["oud"] });
    expect(filtersToQuery(f)).toBe("?wear=evening&note=oud");
    expect(filtersToQuery(NO_FILTERS)).toBe("");
  });

  it("lists every note in use once, by name", () => {
    const list = notesInUse(FRAGRANCES);
    expect(new Set(list.map((n) => n.slug)).size).toBe(list.length);
    expect(list.map((n) => n.name)).toEqual(
      [...list.map((n) => n.name)].sort((a, b) => a.localeCompare(b)),
    );
  });
});
