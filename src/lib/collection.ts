/**
 * The "All fragrances" filters: when to wear it, the season, and the notes. Pure functions, so the
 * page, the URL and the tests agree. Within one group any choice matches (evening OR night);
 * across groups every group must match (evening AND winter AND oud).
 */
import { MOMENTS, SEASONS, type Fragrance, type Moment, type Season } from "./fragrance";

export type CollectionFilters = { wear: Moment[]; season: Season[]; note: string[] };

export const NO_FILTERS: CollectionFilters = { wear: [], season: [], note: [] };

const pick = <T extends string>(raw: string | null, allowed: readonly T[]) =>
  [...new Set((raw ?? "").split(",").map((s) => s.trim().toLowerCase()))].filter((s): s is T =>
    (allowed as readonly string[]).includes(s),
  );

/** From the address bar: ?wear=evening,night&season=winter&note=oud */
export function parseFilters(
  params: { get(name: string): string | null },
  notes: readonly string[],
): CollectionFilters {
  return {
    wear: pick(params.get("wear"), MOMENTS),
    season: pick(params.get("season"), SEASONS),
    note: pick(params.get("note"), notes),
  };
}

/** Back to the address bar ("" when nothing is chosen) */
export function filtersToQuery(f: CollectionFilters) {
  const q = new URLSearchParams();
  if (f.wear.length) q.set("wear", f.wear.join(","));
  if (f.season.length) q.set("season", f.season.join(","));
  if (f.note.length) q.set("note", f.note.join(","));
  const s = q.toString().replace(/%2C/g, ",");
  return s ? `?${s}` : "";
}

export const filterCount = (f: CollectionFilters) =>
  f.wear.length + f.season.length + f.note.length;

type Filterable = Pick<Fragrance, "profile" | "notes">;

export function matches(f: Filterable, filters: CollectionFilters) {
  const any = <T>(chosen: T[], has: T[]) => !chosen.length || chosen.some((c) => has.includes(c));
  return (
    any(filters.wear, f.profile?.moments ?? []) &&
    any(filters.season, f.profile?.seasons ?? []) &&
    any(
      filters.note,
      f.notes.map((n) => n.slug),
    )
  );
}

/** Every note in use across the collection, by name, for the notes filter */
export function notesInUse(fragrances: Pick<Fragrance, "notes">[]) {
  const seen = new Map<string, string>();
  for (const f of fragrances) for (const n of f.notes) seen.set(n.slug, n.name);
  return [...seen]
    .map(([slug, name]) => ({ slug, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------------------------------------------------------------------------------------------- */
/* Sort                                                                                             */

export const SORTS = ["featured", "price-asc", "price-desc", "rating"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABELS: Record<Sort, string> = {
  featured: "Featured",
  "price-asc": "Price, low to high",
  "price-desc": "Price, high to low",
  rating: "Top rated",
};

/** Approved reviews per fragrance, by slug (only those that have some) */
export type Ratings = Record<string, { average: number; count: number }>;

/** ?sort=price-asc; "featured" (the house's own order) when absent or unknown */
export function parseSort(params: { get(name: string): string | null }): Sort {
  const raw = params.get("sort");
  return (SORTS as readonly string[]).includes(raw ?? "") ? (raw as Sort) : "featured";
}

/** The filters' query with the sort added (left out when it's the house's own order) */
export function queryWithSort(filtersQuery: string, sort: Sort) {
  if (sort === "featured") return filtersQuery;
  return filtersQuery ? `${filtersQuery}&sort=${sort}` : `?sort=${sort}`;
}

type Sortable = Pick<Fragrance, "slug" | "sortOrder" | "variants">;

/** The list in the chosen order; ties keep the house's order */
export function sortFragrances<T extends Sortable>(list: T[], sort: Sort, ratings: Ratings = {}) {
  const price = (f: T) => f.variants[0]?.pricePoisha ?? Number.MAX_SAFE_INTEGER;
  const rated = (f: T) => ratings[f.slug];
  const by: Record<Sort, (a: T, b: T) => number> = {
    featured: () => 0,
    "price-asc": (a, b) => price(a) - price(b),
    "price-desc": (a, b) => price(b) - price(a),
    rating: (a, b) =>
      (rated(b)?.average ?? 0) - (rated(a)?.average ?? 0) ||
      (rated(b)?.count ?? 0) - (rated(a)?.count ?? 0),
  };
  return [...list].sort((a, b) => by[sort](a, b) || a.sortOrder - b.sortOrder);
}
